export const TIKTOK_DATA_DOMAINS = [
  "overview",
  "orders",
  "finance",
  "team",
  "stores",
  "fulfillment",
  "design"
] as const;

export type TiktokDataDomain = typeof TIKTOK_DATA_DOMAINS[number];

export interface TiktokDataScope {
  unrestricted: boolean;
  domains: TiktokDataDomain[];
  teamIds: number[];
  storeIds: number[];
  userIds: number[];
}

export interface TiktokToolInput {
  startDate: string;
  endDate: string;
  timeZone: "America/Los_Angeles";
  scope: TiktokDataScope;
  question: string;
}

export interface TiktokToolSource {
  id: "feline-tiktok";
  access: "read-only";
  tables: string[];
  generatedAtUtc: string;
  dataUpdatedAtUtc: string;
  timeZone: "America/Los_Angeles";
  qualityWarnings: string[];
}

export interface TiktokToolOutput {
  domain: TiktokDataDomain;
  range: { startDate: string; endDate: string; timeZone: string };
  accessScope?: { unrestricted: boolean; labels: string[] };
  data: unknown;
  source: TiktokToolSource;
}
