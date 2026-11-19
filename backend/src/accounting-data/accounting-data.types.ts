export const ACCOUNTING_DATA_DOMAINS = ["overview", "transactions", "purchases", "accounts", "receivables", "conversions"] as const;
export type AccountingDataDomain = typeof ACCOUNTING_DATA_DOMAINS[number];

export interface AccountingDataPayload {
  report: { startDate: string; endDate: string; timeZone: string; currency: string; generatedAt: string };
  source: { id: string; access: "read-only"; dataUpdatedAt: string };
  summary?: {
    income?: number; expense?: number; netCashFlow?: number; transactions?: number; count?: number;
    activeAccounts?: number; openReceivables?: number; outstandingReceivables?: number;
  };
  trend?: Array<{ date: string; income: number; expense: number }>;
  categories?: Array<{ id: string; name: string; income: number; expense: number }>;
  purchaseStatuses?: Array<{ status: string; count: number; amount: number }>;
  conversionStatuses?: Array<{ status: string; count: number; amountUsd: number; amountVnd: number }>;
  recentPurchases?: Array<Record<string, unknown>>;
  transactions?: Array<Record<string, unknown>>;
  purchases?: Array<Record<string, unknown>>;
  accounts?: Array<Record<string, unknown>>;
  receivables?: Array<Record<string, unknown>>;
  conversions?: Array<Record<string, unknown>>;
}

export interface AccountingRoute {
  kind: "knowledge" | "data";
  domain?: AccountingDataDomain;
  startDate?: string;
  endDate?: string;
  query?: string;
}
