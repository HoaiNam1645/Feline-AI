import { Injectable } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { SourceMysqlService } from "../../source/source-mysql.service";
import { AgentTool } from "./agent-tool";
import { SearchEngineService } from "../search/search-engine.service";

interface InventoryRow extends RowDataPacket {
  productId: number;
  productName: string;
  productStyle: string | null;
  brand: string | null;
  mockupUrl: string | null;
  warehouseName: string | null;
  variantId: string;
  sku: string | null;
  variantStyle: string | null;
  color: string | null;
  size: string | null;
  stock: string | number;
  pendingDemand: string | number;
  reserved: string | number;
  productUpdatedAt: string | null;
  variantUpdatedAt: string | null;
}

interface DecorationRow extends RowDataPacket {
  productId: number;
  method: string;
}

export interface InventoryVariantMetric {
  variantId: string;
  sku: string | null;
  style: string | null;
  color: string | null;
  size: string | null;
  stock: number;
  reserved: number;
  available: number;
  pendingDemand: number;
}

export interface InventoryProductMetric {
  productId: number;
  name: string;
  style: string | null;
  brand: string | null;
  mockupUrl: string | null;
  warehouseName: string | null;
  methods: string[];
  variantCount: number;
  stock: number;
  reserved: number;
  available: number;
  pendingDemand: number;
}

export interface InventoryMetricsToolOutput {
  queryMode: "catalog" | "lookup";
  summary: {
    productCount: number;
    variantCount: number;
    totalStock: number;
    totalReserved: number;
    totalAvailable: number;
    lowStockVariants: number;
    outOfStockVariants: number;
  };
  products: InventoryProductMetric[];
  matchedProducts: InventoryProductMetric[];
  matchedVariants: Array<InventoryVariantMetric & {
    productId: number;
    productName: string;
    productStyle: string | null;
  }>;
  exactMatchFound: boolean;
  source: {
    id: "shop-test";
    access: "read-only";
    generatedAtUtc: string;
    dataUpdatedAtUtc: string;
  };
}

@Injectable()
export class InventoryMetricsTool implements AgentTool<
  { question: string; productIds?: number[] },
  InventoryMetricsToolOutput
> {
  readonly id = "lemiex.metrics.inventory";
  readonly description = "Đọc catalog sản phẩm và tồn kho khả dụng đã xác minh cho Admin/Manager từ nguồn shop-test chỉ đọc.";

  constructor(
    private readonly source: SourceMysqlService,
    private readonly search: SearchEngineService = new SearchEngineService()
  ) {}

  async execute(input: { question: string; productIds?: number[] }): Promise<InventoryMetricsToolOutput> {
    const [rows, decorations] = await Promise.all([
      this.source.query<InventoryRow>(`
        SELECT
          p.id AS productId,
          p.name AS productName,
          p.style AS productStyle,
          p.brand,
          p.mockup AS mockupUrl,
          p.warehouse_name AS warehouseName,
          pv.variant_id AS variantId,
          pv.sku,
          pv.style AS variantStyle,
          pv.color,
          pv.size,
          pv.stock,
          pv.pending_demand AS pendingDemand,
          COALESCE(reserved.quantity, 0) AS reserved,
          p.updated_at AS productUpdatedAt,
          pv.updated_at AS variantUpdatedAt
        FROM products p
        INNER JOIN product_variants pv
          ON pv.product_id = p.id
         AND pv.active = 1
         AND pv.deleted_at IS NULL
        LEFT JOIN (
          SELECT pr.product_variant_id, SUM(pr.quantity) AS quantity
          FROM productions pr
          INNER JOIN order_items oi
            ON oi.id = pr.order_item_id
           AND oi.deleted_at IS NULL
          INNER JOIN orders o
            ON o.id = oi.order_id
           AND o.deleted_at IS NULL
           AND o.fulfill_status NOT IN ('cancelled', 'cancelled_refund_shipping', 'shipped', 'closed')
          WHERE pr.status = 'pending'
          GROUP BY pr.product_variant_id
        ) reserved ON reserved.product_variant_id = pv.variant_id
        WHERE p.status = 1
          AND p.deleted_at IS NULL
        ORDER BY p.name, p.style, pv.color, pv.size, pv.variant_id
      `),
      this.source.query<DecorationRow>(`
        SELECT pdm.product_id AS productId, pdm.method
        FROM product_decoration_methods pdm
        INNER JOIN products p ON p.id = pdm.product_id
        WHERE p.status = 1 AND p.deleted_at IS NULL
        ORDER BY pdm.product_id, pdm.method
      `)
    ]);

    const methods = new Map<number, string[]>();
    for (const row of decorations) {
      methods.set(row.productId, [...(methods.get(row.productId) || []), row.method]);
    }

    const products = new Map<number, InventoryProductMetric>();
    const variants = rows.map((row) => {
      const stock = this.number(row.stock);
      const reserved = this.number(row.reserved);
      const pendingDemand = this.number(row.pendingDemand);
      const variant: InventoryVariantMetric & {
        productId: number;
        productName: string;
        productStyle: string | null;
      } = {
        productId: row.productId,
        productName: row.productName,
        productStyle: row.productStyle,
        variantId: row.variantId,
        sku: row.sku,
        style: row.variantStyle,
        color: row.color,
        size: row.size,
        stock,
        reserved,
        available: stock - reserved,
        pendingDemand
      };
      const product = products.get(row.productId) || {
        productId: row.productId,
        name: row.productName,
        style: row.productStyle,
        brand: row.brand,
        mockupUrl: row.mockupUrl,
        warehouseName: row.warehouseName,
        methods: methods.get(row.productId) || [],
        variantCount: 0,
        stock: 0,
        reserved: 0,
        available: 0,
        pendingDemand: 0
      };
      product.variantCount += 1;
      product.stock += stock;
      product.reserved += reserved;
      product.available += stock - reserved;
      product.pendingDemand += pendingDemand;
      products.set(row.productId, product);
      return variant;
    });

    const productList = [...products.values()];
    const normalizedQuestion = this.search.normalize(input.question);
    const queryMode = /danh sach san pham|cac san pham nao|nhung san pham nao|co san pham gi/.test(normalizedQuestion)
      ? "catalog" as const
      : "lookup" as const;
    const variantsByProduct = new Map<number, typeof variants>();
    for (const variant of variants) variantsByProduct.set(
      variant.productId,
      [...(variantsByProduct.get(variant.productId) || []), variant]
    );
    const rankedProducts = this.search.rank(input.question, productList.map((product) => ({
      item: product.productId,
      fields: [
        { value: product.name, weight: 5 },
        { value: product.style, weight: 4 },
        { value: product.brand, weight: 2 },
        ...(variantsByProduct.get(product.productId) || []).slice(0, 80).flatMap((variant) => [
          { value: variant.sku, weight: 4 },
          { value: variant.variantId, weight: 2 },
          { value: variant.style, weight: 2 }
        ])
      ]
    })));
    const highestScore = rankedProducts[0]?.score || 0;
    const approvedProductIds = new Set((input.productIds || []).filter((id) =>
      Number.isInteger(id) && products.has(id)
    ));
    const matchedProductIds = approvedProductIds.size
      ? approvedProductIds
      : new Set(rankedProducts
          .filter((result) => result.score === highestScore && result.score >= 50)
          .map((result) => result.item));

    const updatedTimes = rows.flatMap((row) => [row.productUpdatedAt, row.variantUpdatedAt])
      .flatMap((value) => {
        if (!value) return [];
        const parsed = new Date(`${value.replace(" ", "T")}Z`).getTime();
        return Number.isNaN(parsed) ? [] : [parsed];
      });
    const generatedAtUtc = new Date().toISOString();
    const totalStock = variants.reduce((sum, variant) => sum + variant.stock, 0);
    const totalReserved = variants.reduce((sum, variant) => sum + variant.reserved, 0);

    return {
      queryMode,
      summary: {
        productCount: productList.length,
        variantCount: variants.length,
        totalStock,
        totalReserved,
        totalAvailable: totalStock - totalReserved,
        lowStockVariants: variants.filter((variant) => variant.stock < 5).length,
        outOfStockVariants: variants.filter((variant) => variant.stock <= 0).length
      },
      products: productList,
      matchedProducts: productList.filter((product) => matchedProductIds.has(product.productId)),
      matchedVariants: variants
        .filter((variant) => matchedProductIds.has(variant.productId))
        .slice(0, 200),
      exactMatchFound: matchedProductIds.size > 0,
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc,
        dataUpdatedAtUtc: updatedTimes.length
          ? new Date(Math.max(...updatedTimes)).toISOString()
          : generatedAtUtc
      }
    };
  }

  private number(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
