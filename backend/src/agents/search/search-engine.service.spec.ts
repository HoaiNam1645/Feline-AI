import { SearchEngineService } from "./search-engine.service";

describe("SearchEngineService", () => {
  const search = new SearchEngineService();

  it("routes seller pricing and extracts Vietnamese filters", () => {
    expect(search.analyze("Giá thêu áo G5000 size S màu đen của seller Feline")).toMatchObject({
      intent: "seller_pricing",
      filters: { color: "black", size: "S", method: "embroidery" }
    });
    expect(search.analyze("Giá Stitch Fees của simplehub").intent).toBe("seller_pricing");
  });

  it("routes inventory questions without AI", () => {
    expect(search.analyze("G5000 Black size S còn bao nhiêu trong kho?").intent).toBe("inventory");
  });

  it("routes exact order identifiers", () => {
    expect(search.analyze("Kiểm tra tracking 9400111899223856928499")).toMatchObject({
      intent: "order_lookup",
      orderIdentifiers: ["9400111899223856928499"]
    });
    expect(search.analyze("Xem đơn id 999150688703")).toMatchObject({
      intent: "order_lookup",
      orderIdentifiers: ["999150688703"]
    });
    expect(search.analyze("Kiểm tra đơn ref_id USLCK4EQK7_577530775113076894")).toMatchObject({
      intent: "order_lookup",
      orderIdentifiers: ["USLCK4EQK7_577530775113076894"]
    });
  });

  it("ranks aliases and tolerates a small typo", () => {
    const ranked = search.rank("gia g500 cua seller feline", [
      { item: "g5000", fields: [{ value: "G5000", weight: 3 }] },
      { item: "g18000", fields: [{ value: "G18000", weight: 3 }] }
    ]);
    expect(ranked[0].item).toBe("g5000");
  });

  it("resolves relative and explicit date ranges without AI", () => {
    expect(search.resolveDateRange("Số lượng đơn hàng trong 7 ngày qua?", "2026-11-09"))
      .toEqual({
        startDate: "2026-11-03",
        endDate: "2026-11-09",
        days: 7,
        explicit: true
      });
    expect(search.resolveDateRange("Từ 01/11/2026 đến 09/11/2026 có bao nhiêu đơn?", "2026-11-09"))
      .toEqual({
        startDate: "2026-11-01",
        endDate: "2026-11-09",
        days: 9,
        explicit: true
      });
  });
});
