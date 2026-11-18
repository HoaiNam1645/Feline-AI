export interface EtsyDashboardFilters {
  sellerTeamIds: string[];
  shopIds: string[];
  sellerIds: string[];
}

export const ETSY_DATA_DOMAINS = ["overview", "orders", "finance", "team", "shops", "fulfillment", "support", "products"] as const;
export type EtsyDataDomain = typeof ETSY_DATA_DOMAINS[number];

export interface EtsyDashboardData {
  report: { startDate: string; endDate: string; timeZone: string; currency: string; generatedAt: string };
  source: { dataUpdatedAt: string | null; shopSyncedAt: string | null };
  filters: {
    sellerTeams: Array<{ id: string; name: string }>;
    shops: Array<{ id: string; name: string }>;
    sellers: Array<{ id: string; name: string; email: string; teamId: string | null }>;
  };
  summary: {
    orders: number; items: number; grossBookedValue: number; recognizedRevenue: number;
    etsyNet: number; fulfillmentCost: number; designCost: number; refundAmount: number;
    manualCost: number; manualCostVnd: number; operationalProfit: number; funds: number; fundsVnd: number; shops: number; activeSellers: number;
  };
  statuses: Array<{ status: string; orders: number }>;
  trend: Array<{ date: string; orders: number; items: number; net: number; profit: number }>;
  sellerTeams: Array<{ id: string; name: string; members: number; orders: number; items: number; grossBookedValue: number; net: number; profit: number }>;
  shops: Array<{ id: string; name: string; orders: number; items: number; net: number; profit: number; funds: number; fundsVnd: number }>;
  sellers: Array<{ id: string; name: string; email: string; teamId: string | null; teamName: string; orders: number; items: number; grossBookedValue: number; net: number; fulfillmentCost: number; designCost: number; refundAmount: number; profit: number }>;
  topProducts: Array<{ name: string; shopId: string; shopName: string; quantity: number; grossBookedValue: number; net: number }>;
  quality: { totalOrders: number; noSkuOrders: number; unknownSellerOrders: number; fallbackNetOrders: number; orderNetOrders: number; actualNetOrders: number; missingShopOrders: number; unattributedOrders: number; attributionRate: number; unknownPrefixes: Array<{ prefix: string; orders: number }> };
}
