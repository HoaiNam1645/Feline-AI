import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { SourceMysqlService } from "../../source/source-mysql.service";
import { AgentTool } from "./agent-tool";
import { SearchEngineService } from "../search/search-engine.service";

interface SellerRow extends RowDataPacket {
  sellerId: number;
  username: string;
  tierId: number | null;
  tierName: string | null;
  stores: string | null;
  updatedAt: string | null;
}

interface VariantRow extends RowDataPacket {
  id: number;
  productId: number;
  productName: string;
  productStyle: string | null;
  variantId: string;
  sku: string | null;
  variantStyle: string | null;
  color: string | null;
  size: string | null;
}

interface PriceRow extends RowDataPacket {
  productVariantId: number;
  type: string;
  method: string | null;
  price: string | number;
  updatedAt: string | null;
}

export interface SellerPricingMetricsToolOutput {
  sellerFound: boolean;
  seller?: {
    sellerId: number;
    username: string;
    stores: string[];
    tierId: number | null;
    tierName: string | null;
  };
  productLookupRequested: boolean;
  productFound: boolean;
  filters: {
    color: string | null;
    size: string | null;
    method: string | null;
  };
  products: Array<{
    productId: number;
    name: string;
    style: string | null;
    variants: Array<{
      variantId: string;
      sku: string | null;
      style: string | null;
      color: string | null;
      size: string | null;
      prices: Array<{ type: string; method: string | null; price: number }>;
    }>;
  }>;
  source: {
    id: "shop-test";
    access: "read-only";
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
  };
}

@Injectable()
export class SellerPricingMetricsTool implements AgentTool<
  { question: string },
  SellerPricingMetricsToolOutput
> {
  readonly id = "lemiex.metrics.seller-pricing";
  readonly description = "Đọc seller, tier và giá theo product variant cho Admin/Manager từ nguồn shop-test chỉ đọc.";

  constructor(
    private readonly source: SourceMysqlService,
    private readonly search: SearchEngineService = new SearchEngineService()
  ) {}

  async execute(input: { question: string }): Promise<SellerPricingMetricsToolOutput> {
    const [sellers, variants] = await Promise.all([
      this.source.query<SellerRow>(`
        SELECT s.seller_id AS sellerId, s.username, s.tier_id AS tierId,
               s.tier_name AS tierName, s.stores,
               s.updated_at AS updatedAt
        FROM sellers s
        ORDER BY s.username
      `),
      this.source.query<VariantRow>(`
        SELECT pv.id, p.id AS productId, p.name AS productName, p.style AS productStyle,
               pv.variant_id AS variantId, pv.sku, pv.style AS variantStyle,
               pv.color, pv.size
        FROM products p
        INNER JOIN product_variants pv ON pv.product_id = p.id
        WHERE p.status = 1 AND p.deleted_at IS NULL
          AND pv.active = 1 AND pv.deleted_at IS NULL
        ORDER BY p.name, p.style, pv.color, pv.size
      `)
    ]);
    const analysis = this.search.analyze(input.question);
    const question = analysis.normalized;
    const seller = this.search.rank(input.question, sellers.map((item) => ({
      item,
      fields: [{ value: item.username, weight: 5 }, { value: item.stores, weight: 3 }]
    })))[0]?.item;
    const productGroups = new Map<number, VariantRow[]>();
    for (const variant of variants) productGroups.set(variant.productId, [...(productGroups.get(variant.productId) || []), variant]);
    const rankedProducts = this.search.rank(input.question, [...productGroups.entries()].map(([productId, rows]) => ({
      item: productId,
      fields: [
        { value: rows[0].productName, weight: 5 },
        { value: rows[0].productStyle, weight: 5 },
        ...rows.slice(0, 40).flatMap((variant) => [
          { value: variant.sku, weight: 4 },
          { value: variant.variantId, weight: 2 },
          { value: variant.variantStyle, weight: 2 }
        ])
      ]
    })));
    const bestProductScore = rankedProducts[0]?.score || 0;
    const productIds = rankedProducts
      .filter((result) => result.score === bestProductScore && result.score >= 50)
      .map((result) => result.item);
    const productLookupRequested = /san pham|product|variant|bien the|sku|style|gia/.test(question)
      && productIds.length > 0;
    const filters = analysis.filters;
    const matchesVariantFilters = (variant: VariantRow) => {
      if (filters.color && this.search.normalize(variant.color || "") !== filters.color) return false;
      if (filters.size && this.search.normalizeSize(variant.size) !== filters.size) return false;
      return true;
    };
    const selectedVariants = productLookupRequested
      ? variants
          .filter((variant) => productIds.includes(variant.productId))
          .filter(matchesVariantFilters)
          .slice(0, 120)
      : [];
    const prices = seller && seller.tierId !== null && selectedVariants.length
      ? await this.source.query<PriceRow>(`
          SELECT product_variant_id AS productVariantId, type, method, price, updated_at AS updatedAt
          FROM product_price_variants
          WHERE tier_id = ? AND product_variant_id IN (${selectedVariants.map(() => "?").join(",")})
          ORDER BY product_variant_id, method, type
        `, [seller.tierId, ...selectedVariants.map((variant) => Number(variant.variantId))])
      : [];
    const pricesByVariant = new Map<number, PriceRow[]>();
    for (const price of prices) {
      const variantId = Number(price.productVariantId);
      pricesByVariant.set(variantId, [...(pricesByVariant.get(variantId) || []), price]);
    }
    const products = productIds.slice(0, 4).flatMap((productId) => {
      const rows = selectedVariants.filter((variant) => variant.productId === productId);
      if (!rows.length) return [];
      return [{
        productId,
        name: rows[0].productName,
        style: rows[0].productStyle,
        variants: rows.map((variant) => ({
          variantId: variant.variantId,
          sku: variant.sku,
          style: variant.variantStyle,
          color: variant.color,
          size: variant.size,
          prices: (pricesByVariant.get(Number(variant.variantId)) || [])
            .filter((price) => !filters.method || this.search.normalize(price.method || "") === filters.method)
            .map((price) => ({
            type: price.type,
            method: price.method,
            price: Number(price.price)
          }))
        }))
      }];
    });
    const updatedTimes = [seller?.updatedAt, ...prices.map((price) => price.updatedAt)].flatMap((value) => {
      if (!value) return [];
      const time = new Date(`${value.replace(" ", "T")}Z`).getTime();
      return Number.isNaN(time) ? [] : [time];
    });
    const generatedAtUtc = new Date().toISOString();
    return {
      sellerFound: Boolean(seller),
      ...(seller ? {
        seller: {
          sellerId: Number(seller.sellerId),
          username: seller.username,
          stores: seller.stores?.split(", ").filter(Boolean) || [],
          tierId: seller.tierId === null ? null : Number(seller.tierId),
          tierName: seller.tierName
        }
      } : {}),
      productLookupRequested,
      productFound: products.length > 0,
      filters,
      products,
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc,
        dataUpdatedAtUtc: updatedTimes.length ? new Date(Math.max(...updatedTimes)).toISOString() : generatedAtUtc
      }
    };
  }

}
