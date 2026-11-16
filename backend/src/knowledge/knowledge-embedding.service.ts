import { Injectable } from "@nestjs/common";

const DIMENSIONS = 192;

@Injectable()
export class KnowledgeEmbeddingService {
  readonly model = "local-hash-embedding-v1";
  readonly dimensions = DIMENSIONS;

  embed(input: string): number[] {
    const vector = Array.from({ length: DIMENSIONS }, () => 0);
    const tokens = this.tokens(input);
    for (const token of tokens) {
      const primary = this.hash(token, 2166136261) % DIMENSIONS;
      const secondary = this.hash(token, 2246822519) % DIMENSIONS;
      vector[primary] += 1;
      vector[secondary] += 0.45;
    }
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1;
    return vector.map((value) => Number((value / magnitude).toFixed(8)));
  }

  similarity(left: number[], right: number[]): number {
    if (left.length !== right.length) return 0;
    return left.reduce((sum, value, index) => sum + value * right[index], 0);
  }

  private tokens(input: string): string[] {
    const normalized = input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized) return [];
    const words = normalized.split(" ").filter((word) => word.length > 1);
    const bigrams = words.slice(0, -1).map((word, index) => `${word}_${words[index + 1]}`);
    return [...words, ...bigrams];
  }

  private hash(value: string, seed: number): number {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash;
  }
}
