import { BadRequestException, Injectable } from "@nestjs/common";
import mammoth from "mammoth";
import pdf from "pdf-parse";

const TEXT_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json"
]);

@Injectable()
export class KnowledgeExtractorService {
  async extract(file: Express.Multer.File): Promise<string> {
    if (TEXT_MIME_TYPES.has(file.mimetype)) return this.clean(file.buffer.toString("utf8"));
    if (file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf")) {
      const result = await pdf(file.buffer);
      return this.clean(result.text);
    }
    if (
      file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || file.originalname.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      return this.clean(result.value);
    }
    throw new BadRequestException("Chỉ hỗ trợ PDF, DOCX, TXT, Markdown, CSV hoặc JSON");
  }

  private clean(value: string): string {
    const text = value.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
    if (text.length < 40) throw new BadRequestException("Tài liệu không có đủ nội dung để lập chỉ mục");
    return text;
  }
}
