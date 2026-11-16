import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
const sharp = require("sharp") as typeof import("sharp/lib/index");
import { AnthropicStructuredProvider } from "../../ai/anthropic-structured.provider";
import { PrismaService } from "../../database/prisma.service";
import { SourceMysqlService } from "../../source/source-mysql.service";
import { InventoryProductMetric } from "../tools/inventory-metrics.tool";

type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface ProductVisualDescriptor {
  category: string;
  objectType: string;
  shape: string[];
  materials: string[];
  constructionFeatures: string[];
  functionalFeatures: string[];
  visualAliases: string[];
  colors: string[];
  visibleText: string[];
}

export interface ProductVisualSearchResult {
  analysis: {
    isProductImage: boolean;
    visualDescription: string;
    candidateProductIds: number[];
    confidence: "low" | "medium" | "high";
  };
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
    estimatedCostUsd: number | null;
  };
}

interface CatalogRow {
  productId: number;
  productName: string;
  productStyle: string | null;
  productBrand: string | null;
  mockupUrl: string | null;
}

@Injectable()
export class ProductVisualIndexService {
  private readonly logger = new Logger(ProductVisualIndexService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly source: SourceMysqlService,
    private readonly provider: AnthropicStructuredProvider
  ) {}

  async search(
    image: { mediaType: ImageMediaType; data: string },
    catalog: InventoryProductMetric[],
    signal?: AbortSignal
  ): Promise<ProductVisualSearchResult> {
    const generation = await this.describeImage(image, signal);
    const productIds = catalog.map((product) => product.productId);
    const profiles = await this.prisma.productVisualProfile.findMany({
      where: { productId: { in: productIds } }
    });
    const ranked = profiles
      .map((profile) => ({
        productId: profile.productId,
        score: this.similarity(
          generation.value,
          profile.descriptor as unknown as ProductVisualDescriptor
        )
      }))
      .sort((left, right) => right.score - left.score);
    const highest = ranked[0]?.score || 0;
    const candidateProductIds = ranked
      .filter((item) => item.score >= Math.max(22, highest * 0.55))
      .slice(0, 5)
      .map((item) => item.productId);
    return {
      analysis: {
        isProductImage: generation.value.category !== "not_product",
        visualDescription: this.descriptorSummary(generation.value),
        candidateProductIds,
        confidence: highest >= 70 ? "high" : highest >= 42 ? "medium" : "low"
      },
      usage: {
        model: generation.model,
        inputTokens: generation.inputTokens,
        outputTokens: generation.outputTokens,
        estimatedCostUsd: generation.estimatedCostUsd
      }
    };
  }

  @Cron("0 15 0 * * *", { timeZone: "Asia/Ho_Chi_Minh" })
  async syncFromSource(): Promise<void> {
    if (!this.provider.isConfigured()) return;
    const rows = await this.source.query<CatalogRow & import("mysql2").RowDataPacket>(`
      SELECT
        p.id AS productId,
        p.name AS productName,
        p.style AS productStyle,
        p.brand AS productBrand,
        p.mockup AS mockupUrl
      FROM products p
      INNER JOIN product_variants pv
        ON pv.product_id = p.id
       AND pv.active = 1
       AND pv.deleted_at IS NULL
      WHERE p.status = 1
        AND p.deleted_at IS NULL
        AND p.mockup IS NOT NULL
        AND p.mockup <> ''
      GROUP BY p.id, p.name, p.style, p.brand, p.mockup
      ORDER BY p.id
    `);
    let indexed = 0;
    for (const row of rows) {
      try {
        if (await this.indexProduct(row)) indexed += 1;
      } catch (error) {
        this.logger.warn(`Không thể index ảnh catalog product ${row.productId}: ${error instanceof Error ? error.message : "unknown"}`);
      }
    }
    this.logger.log(`Visual catalog sync hoàn tất: ${indexed}/${rows.length} ảnh được cập nhật`);
  }

  private async indexProduct(product: CatalogRow): Promise<boolean> {
    if (!product.mockupUrl) return false;
    const downloaded = await this.downloadImage(product.mockupUrl);
    if (!downloaded) return false;
    const existing = await this.prisma.productVisualProfile.findUnique({
      where: { productId: product.productId }
    });
    if (existing?.imageChecksum === downloaded.checksum) return false;
    const generation = await this.describeImage({
      mediaType: downloaded.mediaType,
      data: downloaded.data
    });
    await this.prisma.productVisualProfile.upsert({
      where: { productId: product.productId },
      create: {
        productId: product.productId,
        productName: product.productName,
        productStyle: product.productStyle,
        productBrand: product.productBrand,
        imageUrl: product.mockupUrl,
        imageChecksum: downloaded.checksum,
        descriptor: generation.value as unknown as Prisma.InputJsonValue,
        indexedAt: new Date()
      },
      update: {
        productName: product.productName,
        productStyle: product.productStyle,
        productBrand: product.productBrand,
        imageUrl: product.mockupUrl,
        imageChecksum: downloaded.checksum,
        descriptor: generation.value as unknown as Prisma.InputJsonValue,
        indexedAt: new Date()
      }
    });
    return true;
  }

  private async describeImage(
    image: { mediaType: ImageMediaType; data: string },
    signal?: AbortSignal
  ) {
    const optimized = await this.optimizeImage(image.mediaType, image.data);
    return this.provider.generateObject<ProductVisualDescriptor>({
      system: [
        "Bạn tạo visual fingerprint trung lập cho ảnh catalog sản phẩm.",
        "Không dùng câu hỏi người dùng, tên file hoặc suy đoán tồn kho.",
        "Mô tả vật thể chính theo hình dạng, vật liệu, cấu tạo, công dụng và các tên gọi thị giác có thể dùng để tìm cùng loại sản phẩm.",
        "Bỏ qua hình in cá nhân hóa nếu nó không thay đổi loại phôi sản phẩm.",
        "Nếu ảnh không chứa sản phẩm hoặc vật thể thương mại, category phải là not_product.",
        "Mọi chuỗi dùng chữ thường tiếng Việt hoặc thuật ngữ tiếng Anh phổ biến, ngắn và không trùng lặp."
      ].join(" "),
      user: "Tạo visual fingerprint cho duy nhất ảnh được đính kèm.",
      toolName: "submit_product_visual_descriptor",
      toolDescription: "Trả đặc trưng thị giác có cấu trúc để lập chỉ mục và tìm sản phẩm tương tự.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        required: [
          "category", "objectType", "shape", "materials", "constructionFeatures",
          "functionalFeatures", "visualAliases", "colors", "visibleText"
        ],
        properties: {
          category: { type: "string", maxLength: 80 },
          objectType: { type: "string", maxLength: 120 },
          shape: { type: "array", maxItems: 8, items: { type: "string", maxLength: 80 } },
          materials: { type: "array", maxItems: 8, items: { type: "string", maxLength: 80 } },
          constructionFeatures: { type: "array", maxItems: 12, items: { type: "string", maxLength: 100 } },
          functionalFeatures: { type: "array", maxItems: 10, items: { type: "string", maxLength: 100 } },
          visualAliases: { type: "array", maxItems: 12, items: { type: "string", maxLength: 100 } },
          colors: { type: "array", maxItems: 8, items: { type: "string", maxLength: 60 } },
          visibleText: { type: "array", maxItems: 8, items: { type: "string", maxLength: 100 } }
        }
      },
      maxOutputTokens: 550,
      signal,
      images: [{ ...optimized, label: "Ảnh duy nhất cần tạo visual fingerprint." }]
    });
  }

  private similarity(query: ProductVisualDescriptor, candidate: ProductVisualDescriptor): number {
    if (query.category === "not_product") return 0;
    return this.fieldSimilarity(query.category, candidate.category) * 24
      + this.fieldSimilarity(query.objectType, candidate.objectType) * 30
      + this.arraySimilarity(query.shape, candidate.shape) * 14
      + this.arraySimilarity(query.materials, candidate.materials) * 10
      + this.arraySimilarity(query.constructionFeatures, candidate.constructionFeatures) * 10
      + this.arraySimilarity(query.functionalFeatures, candidate.functionalFeatures) * 7
      + this.arraySimilarity(query.visualAliases, candidate.visualAliases) * 18
      + this.arraySimilarity(query.visibleText, candidate.visibleText) * 12
      + this.arraySimilarity(query.colors, candidate.colors) * 2;
  }

  private arraySimilarity(left: string[], right: string[]): number {
    if (!left?.length || !right?.length) return 0;
    return Math.max(...left.flatMap((a) => right.map((b) => this.fieldSimilarity(a, b))));
  }

  private fieldSimilarity(left: string, right: string): number {
    const a = this.tokens(left);
    const b = this.tokens(right);
    if (!a.size || !b.size) return 0;
    const intersection = [...a].filter((token) => b.has(token)).length;
    const union = new Set([...a, ...b]).size;
    return intersection / union;
  }

  private tokens(value: string): Set<string> {
    return new Set(value.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("vi-VN")
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((token) => token.length >= 2));
  }

  private descriptorSummary(value: ProductVisualDescriptor): string {
    return [value.objectType, ...value.shape, ...value.materials, ...value.functionalFeatures]
      .filter(Boolean)
      .slice(0, 10)
      .join(", ");
  }

  private async downloadImage(rawUrl: string): Promise<{
    mediaType: ImageMediaType;
    data: string;
    checksum: string;
  } | null> {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || this.isPrivateHost(url.hostname)) return null;
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return null;
    const mediaType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (!this.isImageType(mediaType)) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > 8 * 1024 * 1024) return null;
    return {
      mediaType,
      data: buffer.toString("base64"),
      checksum: createHash("sha256").update(buffer).digest("hex")
    };
  }

  private async optimizeImage(mediaType: ImageMediaType, data: string) {
    try {
      const optimized = await sharp(Buffer.from(data, "base64"), { animated: false })
        .rotate()
        .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 76, effort: 4 })
        .toBuffer();
      return { mediaType: "image/webp" as const, data: optimized.toString("base64") };
    } catch {
      return { mediaType, data };
    }
  }

  private isImageType(value: string | null | undefined): value is ImageMediaType {
    return value === "image/jpeg" || value === "image/png" || value === "image/webp" || value === "image/gif";
  }

  private isPrivateHost(hostname: string): boolean {
    const host = hostname.toLocaleLowerCase("en-US");
    return host === "localhost" || host.endsWith(".local") || host === "::1"
      || /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)
      || /^169\.254\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  }
}
