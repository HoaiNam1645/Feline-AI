import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

@Injectable()
export class KnowledgeObjectStorageService {
  private client: S3Client | null = null;

  async store(file: Express.Multer.File, documentId: string, versionNumber: number): Promise<string | null> {
    if (!this.configured()) return null;
    const client = this.s3();
    const objectKey = `knowledge/${documentId}/v${versionNumber}/${randomUUID()}-${this.safeName(file.originalname)}`;
    await client.send(new PutObjectCommand({
      Bucket: process.env.B2_BUCKET!,
      Key: objectKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentLength: file.size,
      CacheControl: "private, max-age=3600"
    }));
    return objectKey;
  }

  assertConfigured(): void {
    if (!this.configured()) throw new ServiceUnavailableException("Kho file chưa được cấu hình");
  }

  private configured(): boolean {
    return Boolean(
      process.env.B2_BUCKET
      && process.env.B2_ENDPOINT
      && process.env.B2_DEFAULT_REGION
      && process.env.B2_ACCESS_KEY_ID
      && process.env.B2_SECRET_ACCESS_KEY
    );
  }

  private s3(): S3Client {
    if (!this.client) {
      this.client = new S3Client({
        region: process.env.B2_DEFAULT_REGION!,
        endpoint: process.env.B2_ENDPOINT!,
        forcePathStyle: process.env.B2_USE_PATH_STYLE_ENDPOINT === "true",
        credentials: {
          accessKeyId: process.env.B2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.B2_SECRET_ACCESS_KEY!
        }
      });
    }
    return this.client;
  }

  private safeName(value: string): string {
    return value.normalize("NFKC").replace(/[\u0000-\u001f\u007f/\\]/g, "_").slice(0, 160) || "document";
  }
}
