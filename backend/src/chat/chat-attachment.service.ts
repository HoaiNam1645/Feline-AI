import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "node:crypto";
import { requiredString } from "../config/runtime-config";
import { PrismaService } from "../database/prisma.service";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

@Injectable()
export class ChatAttachmentService {
  private readonly bucket = requiredString("B2_BUCKET");
  private readonly client = new S3Client({
    region: requiredString("B2_DEFAULT_REGION"),
    endpoint: requiredString("B2_ENDPOINT"),
    forcePathStyle: process.env.B2_USE_PATH_STYLE_ENDPOINT === "true",
    credentials: {
      accessKeyId: requiredString("B2_ACCESS_KEY_ID"),
      secretAccessKey: requiredString("B2_SECRET_ACCESS_KEY")
    }
  });

  constructor(private readonly prisma: PrismaService) {}

  async upload(userId: string, conversationId: string, file?: Express.Multer.File) {
    await this.assertConversation(userId, conversationId);
    if (!file?.buffer?.length) throw new BadRequestException("Vui lòng chọn ảnh cần tải lên");
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException("Mỗi ảnh không được vượt quá 10 MB");
    const detectedMime = this.detectMime(file.buffer);
    if (!detectedMime || !SUPPORTED_MIME_TYPES.has(detectedMime)) {
      throw new BadRequestException("Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF");
    }
    const existingCount = await this.prisma.chatAttachment.count({
      where: { userId, conversationId, messageId: null }
    });
    if (existingCount >= 5) throw new BadRequestException("Mỗi câu hỏi chỉ được đính kèm tối đa 5 ảnh");

    const objectKey = `chat/${userId}/${conversationId}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${this.extension(detectedMime)}`;
    const checksumSha256 = createHash("sha256").update(file.buffer).digest("hex");
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      Body: file.buffer,
      ContentType: detectedMime,
      ContentLength: file.size,
      CacheControl: "private, max-age=3600",
      Metadata: { checksumSha256 }
    }));
    try {
      const attachment = await this.prisma.chatAttachment.create({
        data: {
          userId, conversationId, objectKey,
          originalName: this.safeName(file.originalname),
          mimeType: detectedMime,
          sizeBytes: file.size,
          checksumSha256
        }
      });
      return this.publicAttachment(attachment);
    } catch (error) {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey })).catch(() => undefined);
      throw error;
    }
  }

  async remove(userId: string, attachmentId: string): Promise<void> {
    const attachment = await this.prisma.chatAttachment.findFirst({ where: { id: attachmentId, userId } });
    if (!attachment) throw new NotFoundException("Không tìm thấy ảnh đính kèm");
    if (attachment.messageId) throw new BadRequestException("Không thể xóa ảnh đã gửi trong hội thoại");
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }));
    await this.prisma.chatAttachment.delete({ where: { id: attachment.id } });
  }

  async removeConversationObjects(userId: string, conversationId: string): Promise<void> {
    const attachments = await this.prisma.chatAttachment.findMany({
      where: { userId, conversationId },
      select: { objectKey: true }
    });
    await Promise.allSettled(attachments.map((attachment) => this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey })
    )));
  }

  async content(userId: string, attachmentId: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const attachment = await this.prisma.chatAttachment.findFirst({ where: { id: attachmentId, userId } });
    if (!attachment) throw new NotFoundException("Không tìm thấy ảnh đính kèm");
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }));
    if (!object.Body) throw new NotFoundException("Nội dung ảnh không còn tồn tại");
    return { buffer: Buffer.from(await object.Body.transformToByteArray()), mimeType: attachment.mimeType };
  }

  async imageInputs(userId: string, conversationId: string, attachmentIds: string[]) {
    const ids = [...new Set(attachmentIds)].slice(0, 5);
    if (!ids.length) return [];
    const attachments = await this.prisma.chatAttachment.findMany({
      where: { id: { in: ids }, userId, conversationId }
    });
    if (attachments.length !== ids.length) throw new BadRequestException("Có ảnh đính kèm không hợp lệ");
    return Promise.all(attachments.map(async (attachment) => {
      const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: attachment.objectKey }));
      if (!object.Body) throw new NotFoundException(`Không đọc được ảnh ${attachment.originalName}`);
      return {
        id: attachment.id,
        name: attachment.originalName,
        mediaType: attachment.mimeType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: Buffer.from(await object.Body.transformToByteArray()).toString("base64")
      };
    }));
  }

  publicAttachment(attachment: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date }) {
    return {
      id: attachment.id,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      createdAt: attachment.createdAt,
      contentUrl: `/api/chat/lemiex/attachments/${attachment.id}/content`
    };
  }

  private async assertConversation(userId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.chatConversation.findFirst({ where: { id: conversationId, userId } });
    if (!conversation) throw new NotFoundException("Không tìm thấy cuộc trò chuyện");
  }

  private detectMime(buffer: Buffer): string | null {
    if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
    if (buffer.subarray(0, 4).toString("ascii") === "GIF8") return "image/gif";
    if (buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
    return null;
  }

  private extension(mimeType: string): string {
    return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" } as Record<string, string>)[mimeType];
  }

  private safeName(value: string): string {
    return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 180) || "image";
  }
}
