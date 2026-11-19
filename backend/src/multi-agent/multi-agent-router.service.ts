import { Injectable } from "@nestjs/common";
import { MultiAgentId } from "./multi-agent.types";

const ALLOWED = new Set<MultiAgentId>(["ceo-ai", "tiktok-ai", "etsy-ai", "lemiex-ai"]);

@Injectable()
export class MultiAgentRouterService {
  route(question: string, requested?: unknown): MultiAgentId[] {
    const explicit = Array.isArray(requested)
      ? requested.filter((value): value is MultiAgentId => typeof value === "string" && ALLOWED.has(value as MultiAgentId))
      : [];
    if (explicit.length) return [...new Set(explicit)];

    const normalized = this.normalize(question);
    const agents: MultiAgentId[] = [];
    if (/\b(tiktok|seller center|livestream|live stream|video ngan|shop tiktok|g9b|cashstorm)\b/.test(normalized)) agents.push("tiktok-ai");
    if (/\b(etsy|listing|shop etsy|store etsy|seller etsy)\b/.test(normalized)) agents.push("etsy-ai");
    if (/\b(lemiex|xuong|fulfillment|theu|shipout|backlog|ton kho|remake)\b/.test(normalized)) agents.push("lemiex-ai");
    if (/\b(nhan su|nghi phep|cham cong|tam ung|hoan ung|noi quy|quy dinh|phuc loi|hop dong lao dong)\b/.test(normalized)) agents.push("ceo-ai");

    const strategic = /\b(ke hoach|chien luoc|tang don|tang doanh thu|muc tieu|phoi hop|toan cong ty|cac phong|hop|phan tich tong the)\b/.test(normalized);
    if (strategic) agents.push("tiktok-ai", "etsy-ai", "lemiex-ai");
    const selected: MultiAgentId[] = agents.length ? agents : ["ceo-ai"];
    return [...new Set(selected)];
  }

  private normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }
}
