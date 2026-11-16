import { Injectable } from "@nestjs/common";

export interface KnowledgeTextChunk {
  index: number;
  content: string;
  tokenEstimate: number;
}

@Injectable()
export class KnowledgeChunkingService {
  split(input: string, maxCharacters = 1200, overlapCharacters = 160): KnowledgeTextChunk[] {
    const text = input.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (!text) return [];
    const paragraphs = text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
    const rawChunks: string[] = [];
    let current = "";
    for (const paragraph of paragraphs) {
      if (paragraph.length > maxCharacters) {
        if (current) rawChunks.push(current);
        current = "";
        this.splitLongParagraph(paragraph, maxCharacters, overlapCharacters).forEach((part) => rawChunks.push(part));
        continue;
      }
      const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
      if (candidate.length <= maxCharacters) {
        current = candidate;
        continue;
      }
      rawChunks.push(current);
      const overlap = current.slice(-overlapCharacters).replace(/^\S*\s/, "").trim();
      current = overlap ? `${overlap}\n\n${paragraph}` : paragraph;
    }
    if (current) rawChunks.push(current);
    return rawChunks.map((content, index) => ({
      index,
      content,
      tokenEstimate: Math.max(1, Math.ceil(content.length / 4))
    }));
  }

  private splitLongParagraph(text: string, max: number, overlap: number): string[] {
    const result: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = Math.min(start + max, text.length);
      if (end < text.length) {
        const boundary = Math.max(text.lastIndexOf(". ", end), text.lastIndexOf("; ", end), text.lastIndexOf(" ", end));
        if (boundary > start + Math.floor(max * 0.6)) end = boundary + 1;
      }
      result.push(text.slice(start, end).trim());
      if (end >= text.length) break;
      start = Math.max(start + 1, end - overlap);
    }
    return result.filter(Boolean);
  }
}
