import { InventoryMetricsTool } from "./inventory-metrics.tool";

describe("InventoryMetricsTool", () => {
  it("calculates available stock and matches a product from the question", async () => {
    const source = {
      query: jest.fn()
        .mockResolvedValueOnce([
          {
            productId: 1,
            productName: "Gildan Heavy Cotton",
            productStyle: "5000",
            brand: "Gildan",
            warehouseName: "Main",
            variantId: "g5000-black-m",
            sku: "G5000-BLK-M",
            variantStyle: "5000",
            color: "Black",
            size: "M",
            stock: "30",
            pendingDemand: "4",
            reserved: "8",
            productUpdatedAt: "2026-11-03 08:00:00",
            variantUpdatedAt: "2026-11-03 09:00:00"
          },
          {
            productId: 2,
            productName: "Hoodie G18500",
            productStyle: "G18500",
            brand: "Gildan",
            warehouseName: "Main",
            variantId: "g18500-black-m",
            sku: "G18500-BLK-M",
            variantStyle: "T-Shirt",
            color: "Black",
            size: "M",
            stock: "10",
            pendingDemand: "0",
            reserved: "0",
            productUpdatedAt: "2026-11-03 08:00:00",
            variantUpdatedAt: "2026-11-03 09:00:00"
          }
        ])
        .mockResolvedValueOnce([{ productId: 1, method: "embroidery" }])
    };
    const tool = new InventoryMetricsTool(source as never);

    const result = await tool.execute({
      question: "Gildan 5000 màu đen size M còn bao nhiêu?"
    });

    expect(result.summary).toMatchObject({
      productCount: 2,
      variantCount: 2,
      totalStock: 40,
      totalReserved: 8,
      totalAvailable: 32
    });
    expect(result.queryMode).toBe("lookup");
    expect(result.exactMatchFound).toBe(true);
    expect(result.matchedProducts[0]).toMatchObject({
      name: "Gildan Heavy Cotton",
      available: 22,
      methods: ["embroidery"]
    });
    expect(result.matchedVariants[0]).toMatchObject({
      sku: "G5000-BLK-M",
      available: 22
    });
    expect(result.matchedProducts).toHaveLength(1);
    expect(result.matchedVariants).toHaveLength(1);
  });
});
