import {
  BadRequestException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  KnowledgeDocumentStatus,
  KnowledgeVersionStatus,
  Prisma,
  UserRole
} from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../database/prisma.service";
import { KnowledgeChunkingService } from "./knowledge-chunking.service";
import { KnowledgeEmbeddingService } from "./knowledge-embedding.service";
import { KnowledgeExtractorService } from "./knowledge-extractor.service";
import { KnowledgeObjectStorageService } from "./knowledge-object-storage.service";

interface KnowledgeActor {
  id: string;
  role: UserRole;
  departmentCode: string | null;
  agentIds?: string[];
}

interface CreateKnowledgeInput {
  agentId?: string;
  title: string;
  category: string;
  description?: string | null;
  ownerDepartmentCode: string;
  ownerDepartmentName: string;
  ownerName: string;
  allowedDepartments: string[];
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
  status: KnowledgeDocumentStatus;
  sourceUrl?: string | null;
  isMock?: boolean;
}

@Injectable()
export class KnowledgeHubService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: KnowledgeChunkingService,
    private readonly embeddings: KnowledgeEmbeddingService,
    private readonly extractor: KnowledgeExtractorService,
    private readonly storage: KnowledgeObjectStorageService
  ) {}

  async list(actor: KnowledgeActor, query: Record<string, unknown>) {
    const search = String(query.search || "").trim();
    const status = this.optionalStatus(query.status);
    const department = String(query.department || "").trim().toUpperCase();
    const agentId = this.requiredAgentId(query.agentId || "ceo-ai", actor);
    const where: Prisma.KnowledgeDocumentWhereInput = {
      agentId,
      ...(status ? { status } : {}),
      ...(department ? { ownerDepartmentCode: department } : {}),
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
          { ownerName: { contains: search, mode: "insensitive" } }
        ]
      } : {}),
      ...this.readableWhere(actor)
    };
    const documents = await this.prisma.knowledgeDocument.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }],
      include: {
        accessRules: { orderBy: { departmentCode: "asc" } },
        versions: {
          orderBy: { versionNumber: "desc" },
          take: 1,
          select: {
            id: true, versionNumber: true, status: true, effectiveFrom: true,
            effectiveTo: true, chunkCount: true, embeddingModel: true, indexedAt: true,
            originalFileName: true, sourceType: true, createdAt: true
          }
        }
      }
    });
    const summary = await this.summary(actor, agentId);
    return { items: documents.map((document) => this.documentView(document)), summary };
  }

  async detail(actor: KnowledgeActor, id: string) {
    const document = await this.prisma.knowledgeDocument.findFirst({
      where: { id, ...this.readableWhere(actor) },
      include: {
        accessRules: { orderBy: { departmentCode: "asc" } },
        versions: {
          orderBy: { versionNumber: "desc" },
          include: { chunks: { orderBy: { chunkIndex: "asc" }, take: 8 } }
        }
      }
    });
    if (!document) throw new NotFoundException("Không tìm thấy tài liệu hoặc bạn không có quyền xem");
    return this.documentView(document);
  }

  async createFromUpload(actorId: string, body: Record<string, unknown>, file?: Express.Multer.File) {
    if (!file?.buffer?.length) throw new BadRequestException("Vui lòng chọn tài liệu cần tải lên");
    if (file.size > 15 * 1024 * 1024) throw new BadRequestException("Tài liệu không được vượt quá 15 MB");
    const text = await this.extractor.extract(file);
    const input = this.parseCreateInput(body);
    const id = randomUUID();
    const slug = await this.uniqueSlug(input.title);
    const objectKey = await this.storage.store(file, id, 1);
    const checksum = createHash("sha256").update(file.buffer).digest("hex");
    const document = await this.prisma.$transaction(async (tx) => {
      const created = await tx.knowledgeDocument.create({
        data: {
          id,
          agentId: input.agentId,
          title: input.title,
          slug,
          category: input.category,
          description: input.description,
          ownerDepartmentCode: input.ownerDepartmentCode,
          ownerDepartmentName: input.ownerDepartmentName,
          ownerName: input.ownerName,
          status: input.status,
          isMock: false,
          createdById: actorId,
          accessRules: { create: input.allowedDepartments.map((code) => ({
            departmentCode: code,
            departmentName: this.departmentName(code),
            canRead: true
          })) }
        }
      });
      const version = await tx.knowledgeDocumentVersion.create({
        data: {
          documentId: created.id,
          versionNumber: 1,
          sourceType: "UPLOAD",
          sourceUrl: input.sourceUrl,
          originalFileName: this.safeFileName(file.originalname),
          mimeType: file.mimetype,
          objectKey,
          checksumSha256: checksum,
          extractedText: text,
          characterCount: text.length,
          effectiveFrom: input.effectiveFrom,
          effectiveTo: input.effectiveTo,
          createdById: actorId
        }
      });
      await tx.accessAuditEvent.create({
        data: {
          actorUserId: actorId,
          eventType: "KNOWLEDGE_DOCUMENT_CREATED",
          targetType: "KnowledgeDocument",
          targetId: created.id,
          detail: { agentId: input.agentId, title: created.title, versionId: version.id, fileName: file.originalname }
        }
      });
      return { created, version };
    });
    await this.indexVersion(document.created.id, document.version.id, 1);
    return this.detail({ id: actorId, role: UserRole.ADMIN, departmentCode: null }, document.created.id);
  }

  async addVersion(actorId: string, documentId: string, body: Record<string, unknown>, file?: Express.Multer.File) {
    const current = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!current) throw new NotFoundException("Không tìm thấy tài liệu");
    if (!file?.buffer?.length) throw new BadRequestException("Vui lòng chọn file phiên bản mới");
    if (file.size > 15 * 1024 * 1024) throw new BadRequestException("Tài liệu không được vượt quá 15 MB");
    const text = await this.extractor.extract(file);
    const versionNumber = current.currentVersionNumber + 1;
    const objectKey = await this.storage.store(file, documentId, versionNumber);
    const version = await this.prisma.knowledgeDocumentVersion.create({
      data: {
        documentId,
        versionNumber,
        sourceType: "UPLOAD",
        sourceUrl: this.optionalText(body.sourceUrl, 500),
        originalFileName: this.safeFileName(file.originalname),
        mimeType: file.mimetype,
        objectKey,
        checksumSha256: createHash("sha256").update(file.buffer).digest("hex"),
        extractedText: text,
        characterCount: text.length,
        effectiveFrom: this.optionalDate(body.effectiveFrom, "Ngày hiệu lực"),
        effectiveTo: this.optionalDate(body.effectiveTo, "Ngày hết hiệu lực"),
        createdById: actorId
      }
    });
    await this.indexVersion(documentId, version.id, versionNumber);
    await this.audit(actorId, "KNOWLEDGE_VERSION_CREATED", "KnowledgeDocumentVersion", version.id, {
      documentId, versionNumber, fileName: file.originalname
    });
    return this.detail({ id: actorId, role: UserRole.ADMIN, departmentCode: null }, documentId);
  }

  async updateMetadata(actorId: string, documentId: string, body: Record<string, unknown>) {
    const current = await this.prisma.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (!current) throw new NotFoundException("Không tìm thấy tài liệu");
    const allowedDepartments = body.allowedDepartments === undefined
      ? null
      : this.stringArray(body.allowedDepartments, "Phòng ban được đọc").map((code) => code.toUpperCase());
    const updated = await this.prisma.$transaction(async (tx) => {
      const document = await tx.knowledgeDocument.update({
        where: { id: documentId },
        data: {
          ...(body.title !== undefined ? { title: this.requiredText(body.title, "Tên tài liệu", 180) } : {}),
          ...(body.category !== undefined ? { category: this.requiredText(body.category, "Danh mục", 80) } : {}),
          ...(body.description !== undefined ? { description: this.optionalText(body.description, 1000) } : {}),
          ...(body.ownerDepartmentCode !== undefined ? { ownerDepartmentCode: this.requiredCode(body.ownerDepartmentCode, "Phòng ban sở hữu") } : {}),
          ...(body.ownerDepartmentName !== undefined ? { ownerDepartmentName: this.requiredText(body.ownerDepartmentName, "Tên phòng ban", 120) } : {}),
          ...(body.ownerName !== undefined ? { ownerName: this.requiredText(body.ownerName, "Chủ sở hữu", 120) } : {}),
          ...(body.status !== undefined ? { status: this.requiredStatus(body.status) } : {})
        }
      });
      if (allowedDepartments) {
        await tx.knowledgeDocumentAccess.deleteMany({ where: { documentId } });
        await tx.knowledgeDocumentAccess.createMany({
          data: allowedDepartments.map((code) => ({
            documentId,
            departmentCode: code,
            departmentName: this.departmentName(code),
            canRead: true
          }))
        });
      }
      return document;
    });
    await this.audit(actorId, "KNOWLEDGE_DOCUMENT_UPDATED", "KnowledgeDocument", documentId, {
      before: { title: current.title, status: current.status },
      after: { title: updated.title, status: updated.status }
    });
    return this.detail({ id: actorId, role: UserRole.ADMIN, departmentCode: null }, documentId);
  }

  async reindex(actorId: string, documentId: string) {
    const version = await this.prisma.knowledgeDocumentVersion.findFirst({
      where: { documentId },
      orderBy: { versionNumber: "desc" }
    });
    if (!version) throw new NotFoundException("Tài liệu chưa có phiên bản để lập chỉ mục");
    await this.indexVersion(documentId, version.id, version.versionNumber, true);
    await this.audit(actorId, "KNOWLEDGE_VERSION_REINDEXED", "KnowledgeDocumentVersion", version.id, {
      documentId, versionNumber: version.versionNumber
    });
    return this.detail({ id: actorId, role: UserRole.ADMIN, departmentCode: null }, documentId);
  }

  async removeMockDocuments(actorId: string, agentId: unknown = "ceo-ai") {
    const normalizedAgentId = this.knownAgentId(agentId);
    const result = await this.prisma.knowledgeDocument.deleteMany({ where: { agentId: normalizedAgentId, isMock: true } });
    await this.audit(actorId, "KNOWLEDGE_MOCK_REMOVED", "KnowledgeDocument", null, { agentId: normalizedAgentId, count: result.count });
    return { removed: result.count };
  }

  async search(actor: KnowledgeActor, body: Record<string, unknown>) {
    const query = this.requiredText(body.query, "Câu tìm kiếm", 500);
    const agentId = this.requiredAgentId(body.agentId || "ceo-ai", actor);
    const limit = Math.min(Math.max(Number(body.limit) || 8, 1), 20);
    const now = new Date();
    const chunks = await this.prisma.knowledgeChunk.findMany({
      where: {
        version: {
          status: KnowledgeVersionStatus.READY,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
          document: {
            agentId,
            status: KnowledgeDocumentStatus.PUBLISHED,
            ...this.readableWhere(actor)
          }
        }
      },
      include: {
        version: {
          include: {
            document: { include: { accessRules: true } }
          }
        }
      }
    });
    const activeVersionByDocument = new Map<string, number>();
    chunks.forEach((chunk) => {
      const documentId = chunk.version.document.id;
      const activeVersion = activeVersionByDocument.get(documentId) || 0;
      if (chunk.version.versionNumber > activeVersion) {
        activeVersionByDocument.set(documentId, chunk.version.versionNumber);
      }
    });
    const vector = this.embeddings.embed(query);
    return chunks
      .filter((chunk) => chunk.version.versionNumber === activeVersionByDocument.get(chunk.version.document.id))
      .map((chunk) => ({
        score: this.embeddings.similarity(vector, this.numberArray(chunk.embedding)),
        chunkId: chunk.id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        document: {
          id: chunk.version.document.id,
          title: chunk.version.document.title,
          category: chunk.version.document.category,
          ownerName: chunk.version.document.ownerName,
          ownerDepartmentName: chunk.version.document.ownerDepartmentName,
          versionNumber: chunk.version.versionNumber,
          effectiveFrom: chunk.version.effectiveFrom,
          effectiveTo: chunk.version.effectiveTo
        }
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, limit)
      .map((item) => ({ ...item, score: Number(item.score.toFixed(4)) }));
  }

  async cacheFingerprint(actor: KnowledgeActor, agentId = "ceo-ai"): Promise<string> {
    const normalizedAgentId = this.requiredAgentId(agentId, actor);
    const now = new Date();
    const versions = await this.prisma.knowledgeDocumentVersion.findMany({
      where: {
        status: KnowledgeVersionStatus.READY,
        effectiveFrom: { lte: now },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        document: {
          agentId: normalizedAgentId,
          status: KnowledgeDocumentStatus.PUBLISHED,
          ...this.readableWhere(actor)
        }
      },
      select: { documentId: true, versionNumber: true },
      orderBy: [{ documentId: "asc" }, { versionNumber: "desc" }]
    });
    const active = new Map<string, number>();
    versions.forEach((version) => {
      if (!active.has(version.documentId)) active.set(version.documentId, version.versionNumber);
    });
    return createHash("sha256")
      .update([...active.entries()].map(([documentId, version]) => `${documentId}:v${version}`).join("|"))
      .digest("hex");
  }

  async createMockDocument(input: CreateKnowledgeInput, content: string): Promise<void> {
    const agentId = this.knownAgentId(input.agentId || "ceo-ai");
    const existing = await this.prisma.knowledgeDocument.findFirst({ where: { agentId, title: input.title, isMock: true } });
    if (existing) return;
    const id = randomUUID();
    const document = await this.prisma.knowledgeDocument.create({
      data: {
        id,
        agentId,
        title: input.title,
        slug: await this.uniqueSlug(input.title),
        category: input.category,
        description: input.description,
        ownerDepartmentCode: input.ownerDepartmentCode,
        ownerDepartmentName: input.ownerDepartmentName,
        ownerName: input.ownerName,
        status: input.status,
        isMock: true,
        accessRules: { create: input.allowedDepartments.map((code) => ({
          departmentCode: code,
          departmentName: this.departmentName(code),
          canRead: true
        })) },
        versions: { create: {
          versionNumber: 1,
          sourceType: "MOCK",
          sourceUrl: input.sourceUrl,
          checksumSha256: createHash("sha256").update(content).digest("hex"),
          extractedText: content,
          characterCount: content.length,
          effectiveFrom: input.effectiveFrom || new Date("2026-01-01T00:00:00+07:00"),
          effectiveTo: input.effectiveTo
        } }
      },
      include: { versions: true }
    });
    await this.indexVersion(document.id, document.versions[0].id, 1);
  }

  private async indexVersion(documentId: string, versionId: string, versionNumber: number, replace = false) {
    const version = await this.prisma.knowledgeDocumentVersion.findUnique({ where: { id: versionId } });
    if (!version) throw new NotFoundException("Không tìm thấy phiên bản tài liệu");
    const chunks = this.chunking.split(version.extractedText);
    if (!chunks.length) throw new BadRequestException("Không thể tạo đoạn tri thức từ tài liệu");
    try {
      await this.prisma.$transaction(async (tx) => {
        if (replace) await tx.knowledgeChunk.deleteMany({ where: { versionId } });
        await tx.knowledgeChunk.createMany({
          data: chunks.map((chunk) => ({
            versionId,
            chunkIndex: chunk.index,
            content: chunk.content,
            tokenEstimate: chunk.tokenEstimate,
            embedding: this.embeddings.embed(chunk.content),
            embeddingModel: this.embeddings.model,
            metadata: { documentId, versionNumber, mockEmbedding: true }
          }))
        });
        await tx.knowledgeDocumentVersion.update({
          where: { id: versionId },
          data: {
            status: KnowledgeVersionStatus.READY,
            chunkCount: chunks.length,
            embeddingModel: this.embeddings.model,
            indexedAt: new Date(),
            error: null
          }
        });
        await tx.knowledgeDocument.update({
          where: { id: documentId },
          data: { currentVersionNumber: versionNumber }
        });
      });
    } catch (error) {
      await this.prisma.knowledgeDocumentVersion.update({
        where: { id: versionId },
        data: { status: KnowledgeVersionStatus.FAILED, error: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  private async summary(actor: KnowledgeActor, agentId: string) {
    const where = { agentId, ...this.readableWhere(actor) };
    const [total, published, mock, chunks] = await Promise.all([
      this.prisma.knowledgeDocument.count({ where }),
      this.prisma.knowledgeDocument.count({ where: { ...where, status: KnowledgeDocumentStatus.PUBLISHED } }),
      this.prisma.knowledgeDocument.count({ where: { ...where, isMock: true } }),
      this.prisma.knowledgeChunk.count({ where: { version: { document: where } } })
    ]);
    return { total, published, mock, chunks, embeddingModel: this.embeddings.model };
  }

  private readableWhere(actor: KnowledgeActor): Prisma.KnowledgeDocumentWhereInput {
    if (actor.role === UserRole.ADMIN) return {};
    const departments = ["ALL", ...(actor.departmentCode ? [actor.departmentCode] : [])];
    return {
      ...(actor.agentIds ? { agentId: { in: actor.agentIds } } : {}),
      status: KnowledgeDocumentStatus.PUBLISHED,
      accessRules: { some: { departmentCode: { in: departments }, canRead: true } }
    };
  }

  private documentView<T>(document: T): T { return document; }

  private parseCreateInput(body: Record<string, unknown>): CreateKnowledgeInput {
    const effectiveFrom = this.optionalDate(body.effectiveFrom, "Ngày hiệu lực") || new Date();
    const effectiveTo = this.optionalDate(body.effectiveTo, "Ngày hết hiệu lực");
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException("Ngày hết hiệu lực phải sau ngày hiệu lực");
    }
    const allowedDepartments = this.stringArray(body.allowedDepartments ?? ["ALL"], "Phòng ban được đọc")
      .map((code) => this.requiredCode(code, "Phòng ban được đọc"));
    return {
      agentId: this.knownAgentId(body.agentId || "ceo-ai"),
      title: this.requiredText(body.title, "Tên tài liệu", 180),
      category: this.requiredText(body.category, "Danh mục", 80),
      description: this.optionalText(body.description, 1000),
      ownerDepartmentCode: this.requiredCode(body.ownerDepartmentCode, "Phòng ban sở hữu"),
      ownerDepartmentName: this.requiredText(body.ownerDepartmentName, "Tên phòng ban", 120),
      ownerName: this.requiredText(body.ownerName, "Chủ sở hữu", 120),
      allowedDepartments,
      effectiveFrom,
      effectiveTo,
      status: body.status ? this.requiredStatus(body.status) : KnowledgeDocumentStatus.DRAFT,
      sourceUrl: this.optionalText(body.sourceUrl, 500),
      isMock: false
    };
  }

  private optionalStatus(value: unknown): KnowledgeDocumentStatus | undefined {
    if (!value) return undefined;
    return this.requiredStatus(value);
  }

  private requiredStatus(value: unknown): KnowledgeDocumentStatus {
    const status = String(value);
    if (!Object.values(KnowledgeDocumentStatus).includes(status as KnowledgeDocumentStatus)) {
      throw new BadRequestException("Trạng thái tài liệu không hợp lệ");
    }
    return status as KnowledgeDocumentStatus;
  }

  private requiredText(value: unknown, label: string, max: number): string {
    const text = String(value ?? "").trim();
    if (!text) throw new BadRequestException(`${label} là bắt buộc`);
    if (text.length > max) throw new BadRequestException(`${label} vượt quá ${max} ký tự`);
    return text;
  }

  private optionalText(value: unknown, max: number): string | null {
    const text = String(value ?? "").trim();
    if (!text) return null;
    if (text.length > max) throw new BadRequestException(`Nội dung vượt quá ${max} ký tự`);
    return text;
  }

  private requiredCode(value: unknown, label: string): string {
    const code = String(value ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,40}$/.test(code)) {
      throw new BadRequestException(`${label} chỉ gồm chữ, số, gạch ngang hoặc gạch dưới`);
    }
    return code;
  }

  private knownAgentId(value: unknown): string {
    const agentId = String(value || "").trim();
    if (!new Set(["ceo-ai", "tiktok-ai", "etsy-ai"]).has(agentId)) {
      throw new BadRequestException("Agent không hỗ trợ kho tri thức");
    }
    return agentId;
  }

  private requiredAgentId(value: unknown, actor: KnowledgeActor): string {
    const agentId = this.knownAgentId(value);
    if (actor.role !== UserRole.ADMIN && actor.agentIds && !actor.agentIds.includes(agentId)) {
      throw new NotFoundException("Không tìm thấy tài liệu hoặc bạn không có quyền xem");
    }
    return agentId;
  }

  private stringArray(value: unknown, label: string): string[] {
    let items = value;
    if (typeof value === "string") {
      try { items = JSON.parse(value); } catch { items = value.split(","); }
    }
    if (!Array.isArray(items)) throw new BadRequestException(`${label} phải là danh sách`);
    const result = [...new Set(items.map((item) => String(item).trim()).filter(Boolean))];
    if (!result.length) throw new BadRequestException(`${label} không được để trống`);
    return result;
  }

  private optionalDate(value: unknown, label: string): Date | null {
    if (value === undefined || value === null || value === "") return null;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} không hợp lệ`);
    return date;
  }

  private numberArray(value: Prisma.JsonValue): number[] {
    return Array.isArray(value) ? value.filter((item): item is number => typeof item === "number") : [];
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "document";
    let slug = base;
    let attempt = 1;
    while (await this.prisma.knowledgeDocument.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${base}-${attempt}`;
      attempt += 1;
    }
    return slug;
  }

  private departmentName(code: string): string {
    return ({ ALL: "Toàn công ty", HR: "Nhân sự", FINANCE: "Tài chính", OPERATIONS: "Vận hành", MANAGEMENT: "Ban quản lý", SELL_TIKTOK: "Sell TikTok" } as Record<string, string>)[code] || code;
  }

  private safeFileName(value: string): string {
    return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 180) || "document";
  }

  private audit(
    actorUserId: string,
    eventType: string,
    targetType: string,
    targetId: string | null,
    detail: Prisma.InputJsonValue
  ) {
    return this.prisma.accessAuditEvent.create({
      data: { actorUserId, eventType, targetType, targetId, detail }
    });
  }
}
