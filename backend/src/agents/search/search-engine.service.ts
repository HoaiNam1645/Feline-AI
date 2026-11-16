import { Injectable } from "@nestjs/common";

export type SearchIntent = "order_lookup" | "seller_pricing" | "inventory" | "operations";

export interface SearchAnalysis {
  normalized: string;
  intent: SearchIntent;
  confidence: number;
  orderIdentifiers: string[];
  filters: {
    color: string | null;
    size: string | null;
    method: string | null;
  };
}

export interface DateRangeAnalysis {
  startDate: string;
  endDate: string;
  days: number;
  explicit: boolean;
}

export interface SearchCandidate<T> {
  item: T;
  fields: Array<{ value: string | null | undefined; weight?: number }>;
}

export interface RankedSearchResult<T> {
  item: T;
  score: number;
  matchedValue: string;
}

@Injectable()
export class SearchEngineService {
  resolveDateRange(question: string, anchorDate: string): DateRangeAnalysis {
    const normalized = this.normalize(question);
    const explicitDates = this.extractDates(question);
    if (explicitDates.length >= 2) {
      const [startDate, endDate] = explicitDates.slice(0, 2).sort();
      return this.validatedRange(startDate, endDate, true);
    }
    const dayMatch = normalized.match(/\b(\d{1,2})\s*ngay\s*(?:qua|gan day|vua qua|tro lai)\b/);
    const requestedDays = dayMatch ? Number(dayMatch[1])
      : /\b(?:tuan qua|7 ngay)\b/.test(normalized) ? 7
      : /\b(?:thang qua|30 ngay)\b/.test(normalized) ? 30
      : 1;
    const days = Math.min(Math.max(requestedDays, 1), 31);
    return {
      startDate: shiftDate(anchorDate, -(days - 1)),
      endDate: anchorDate,
      days,
      explicit: days > 1 || explicitDates.length === 1
    };
  }

  analyze(question: string): SearchAnalysis {
    const normalized = this.normalize(question);
    const pricingScore = this.cueScore(normalized, [
      ["bang gia", 5], ["tier", 5], ["hang gia", 5], ["gia", 2],
      ["seller", 3], ["gia san pham", 4], ["gia variant", 5], ["phi", 1],
      ["stitch fee", 6], ["stitch fees", 6], ["embroidery fee", 6]
    ]);
    const inventoryScore = this.cueScore(normalized, [
      ["ton kho", 6], ["trong kho", 5], ["con bao nhieu", 4], ["con lai", 3],
      ["stock", 6], ["sku", 3], ["danh sach san pham", 4], ["kha dung", 4]
    ]);
    const orderIdentifiers = this.extractOrderIdentifiers(question, normalized);
    const orderLookup = orderIdentifiers.length > 0
      && /\b(order|don|ma don|ref|ref id|tracking|van don)\b/.test(normalized);
    const sellerPricing = !orderLookup && pricingScore >= 5
      && (/\bseller\b|\bbang gia\b|\btier\b|\bhang gia\b|\bstitch fees?\b|\bembroidery fee\b/.test(normalized) || /\bgia\b/.test(normalized));
    const inventory = !sellerPricing && inventoryScore >= 4;
    const best = Math.max(pricingScore, inventoryScore, 1);
    return {
      normalized,
      intent: orderLookup ? "order_lookup" : sellerPricing ? "seller_pricing" : inventory ? "inventory" : "operations",
      confidence: Math.min(1, best / 10),
      orderIdentifiers,
      filters: this.extractFilters(normalized)
    };
  }

  private extractOrderIdentifiers(original: string, normalized: string): string[] {
    const patterns = [
      /(?:ref[_\s-]?id|ref)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,})/gi,
      /(?:tracking(?:[_\s-]?id)?|mã\s*vận\s*đơn|ma\s*van\s*don|vận\s*đơn|van\s*don)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,})/gi,
      /(?:orders?\.id|order\s*id|id\s*order|mã\s*đơn|ma\s*don|đơn\s*id|don\s*id|id\s*đơn|id\s*don|order|đơn|don)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9_-]{2,})/gi
    ];
    const reserved = new Set(["id", "order", "don", "ref", "ref_id", "tracking", "tracking_id"]);
    const explicit = patterns.flatMap((pattern) => [...original.matchAll(pattern)].map((match) => match[1]))
      .map((value) => value.trim())
      .filter((value) => !reserved.has(value.toLocaleLowerCase("en-US")));
    if (explicit.length) return [...new Set(explicit)].slice(0, 5);
    if (!/\b(order|don|ma don|ref|tracking|van don)\b/.test(normalized)) return [];
    const candidates = original.match(/[A-Za-z0-9][A-Za-z0-9_-]{4,}/g) || [];
    const stopWords = new Set(["order", "tracking", "ref_id", "thong", "trang", "kiem", "check"]);
    return [...new Set(candidates.filter((value) => {
      const token = this.normalize(value).replaceAll(" ", "");
      return !stopWords.has(token) && /\d/.test(value) && !/^20\d{2}-\d{2}-\d{2}$/.test(value);
    }))].slice(0, 5);
  }

  private extractDates(question: string): string[] {
    const iso = [...question.matchAll(/\b(20\d{2}-\d{2}-\d{2})\b/g)].map((match) => match[1]);
    const vietnamese = [...question.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/g)]
      .map((match) => `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`);
    return [...new Set([...iso, ...vietnamese])].filter((value) => !Number.isNaN(
      new Date(`${value}T00:00:00.000Z`).getTime()
    ));
  }

  private validatedRange(startDate: string, endDate: string, explicit: boolean): DateRangeAnalysis {
    const days = Math.round((
      new Date(`${endDate}T00:00:00.000Z`).getTime()
      - new Date(`${startDate}T00:00:00.000Z`).getTime()
    ) / 86_400_000) + 1;
    if (days < 1 || days > 31) throw new Error("Phạm vi hỏi đáp hỗ trợ tối đa 31 ngày");
    return { startDate, endDate, days, explicit };
  }

  rank<T>(question: string, candidates: Array<SearchCandidate<T>>): Array<RankedSearchResult<T>> {
    const normalizedQuestion = this.normalize(question);
    return candidates.flatMap((candidate) => {
      let bestScore = 0;
      let matchedValue = "";
      for (const field of candidate.fields) {
        const value = this.normalize(field.value || "");
        if (value.length < 2) continue;
        const score = this.fieldScore(normalizedQuestion, value) * (field.weight || 1);
        if (score > bestScore) {
          bestScore = score;
          matchedValue = field.value || "";
        }
      }
      return bestScore > 0 ? [{ item: candidate.item, score: bestScore, matchedValue }] : [];
    }).sort((a, b) => b.score - a.score);
  }

  normalize(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .toLocaleLowerCase("vi-VN")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  normalizeSize(value: string | null | undefined): string {
    const size = this.normalize(value || "").replace(/\s+/g, "").toUpperCase();
    return ({ XXL: "2XL", XXXL: "3XL", XXXXL: "4XL" } as Record<string, string>)[size] || size;
  }

  private extractFilters(question: string): SearchAnalysis["filters"] {
    const colors: Array<[RegExp, string]> = [
      [/\b(?:mau )?den\b|\bblack\b/, "black"],
      [/\b(?:mau )?trang\b|\bwhite\b/, "white"],
      [/\b(?:mau )?do\b|\bred\b/, "red"],
      [/\b(?:mau )?xanh navy\b|\bnavy\b/, "navy"],
      [/\b(?:mau )?xanh duong\b|\bblue\b/, "blue"],
      [/\b(?:mau )?xanh la\b|\bgreen\b/, "green"],
      [/\b(?:mau )?xam\b|\bgrey\b|\bgray\b/, "grey"],
      [/\b(?:mau )?vang\b|\byellow\b/, "yellow"],
      [/\b(?:mau )?hong\b|\bpink\b/, "pink"]
    ];
    const sizeMatch = question.match(/\b(?:size|co)\s*(5xl|4xl|3xl|2xl|xxxxl|xxxl|xxl|xl|xs|s|m|l)\b/i);
    return {
      color: colors.find(([pattern]) => pattern.test(question))?.[1] || null,
      size: sizeMatch ? this.normalizeSize(sizeMatch[1]) : null,
      method: /\btheu\b|\bembroidery\b/.test(question)
        ? "embroidery"
        : /\bin\b|\bprint\b|\bdtg\b|\bdtf\b/.test(question) ? "print" : null
    };
  }

  private cueScore(question: string, cues: Array<[string, number]>): number {
    return cues.reduce((score, [cue, weight]) => score + (question.includes(cue) ? weight : 0), 0);
  }

  private fieldScore(question: string, value: string): number {
    if (question === value) return 1200 + value.length;
    if (question.includes(value)) return 900 + value.length * 2;
    const compact = value.replace(/ez$/, "");
    if (compact.length >= 4 && question.includes(compact)) return 800 + compact.length;
    const questionTokens = question.split(" ").filter((token) => token.length >= 2);
    const valueTokens = value.split(" ").filter((token) => token.length >= 2);
    let matched = 0;
    for (const valueToken of valueTokens) {
      const tokenScore = Math.max(0, ...questionTokens.map((questionToken) =>
        this.tokenSimilarity(questionToken, valueToken)
      ));
      matched += tokenScore;
    }
    return matched > 0 ? matched * 100 / Math.max(1, valueTokens.length) : 0;
  }

  private tokenSimilarity(left: string, right: string): number {
    if (left === right) return 1;
    if (left.length >= 4 && (left.includes(right) || right.includes(left))) return .85;
    const maximumDistance = Math.max(left.length, right.length) >= 7 ? 2 : 1;
    const distance = this.levenshtein(left, right, maximumDistance);
    return distance <= maximumDistance ? .7 - distance * .15 : 0;
  }

  private levenshtein(left: string, right: string, limit: number): number {
    if (Math.abs(left.length - right.length) > limit) return limit + 1;
    let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
      const current = [row];
      let rowMinimum = row;
      for (let column = 1; column <= right.length; column += 1) {
        const value = Math.min(
          current[column - 1] + 1,
          previous[column] + 1,
          previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
        );
        current.push(value);
        rowMinimum = Math.min(rowMinimum, value);
      }
      if (rowMinimum > limit) return limit + 1;
      previous = current;
    }
    return previous[right.length];
  }
}

function shiftDate(reportDate: string, days: number): string {
  const date = new Date(`${reportDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
