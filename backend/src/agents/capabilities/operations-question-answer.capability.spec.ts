import { OperationsQuestionAnswerCapability } from "./operations-question-answer.capability";

describe("OperationsQuestionAnswerCapability", () => {
  const liveContext = {
    metrics: {
      meta: { reportDate: "2026-11-02", generatedAtUtc: "2026-11-02T07:00:00.000Z" },
      intake: { orders: 99, items: 158, quantity: 184 },
      workflow: [],
      shipout: { completedOrders: 57, completedItems: 72 },
      backlog: { totalOrders: 184, byStatus: [], byAgeBand: [] },
      events: [],
      remakes: { cases: 0 },
      dataQuality: { orphanItems: 0 }
    },
    source: {
      id: "shop-test",
      access: "read-only",
      generatedAtUtc: "2026-11-02T07:00:00.000Z",
      dataUpdatedAtUtc: "2026-11-02T06:55:00.000Z"
    }
  };

  it("answers from the approved live metric tool and enforces the Lemiex identity", async () => {
    const tools = { execute: jest.fn(async () => liveContext) };
    const provider = {
      generateObject: jest.fn(async (request) => ({
        value: {
          markdown: "Hôm nay xưởng tiếp nhận **99 đơn** và **158 item**.\n\n**Nguồn dữ liệu:** shop-test.",
          sources: [],
          limitations: []
        },
        model: "test-model",
        inputTokens: 100,
        outputTokens: 40,
        estimatedCostUsd: null,
        request
      }))
    };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      provider as never,
      { contextFor: jest.fn(() => "{\"topic\":\"intake\"}") } as never
    );

    const result = await capability.execute("run-1", {
      question: "Hôm nay có bao nhiêu đơn và item?",
      reportDate: "2026-11-02",
      history: [],
      allowFinancialData: false,
      allowInventoryData: false
    });

    expect(result.output.markdown).toContain("99 đơn");
    expect(result.output.sources[0].label).toContain("read-only");
    expect(tools.execute).toHaveBeenCalledWith(
      "run-1",
      "lemiex.metrics.live-daily",
      { reportDate: "2026-11-02", includeFinancials: false }
    );
    const request = provider.generateObject.mock.calls[0][0];
    expect(request.system).toContain("Bạn là Lemiex AI");
    expect(request.system).toContain("không phải CEO AI");
    expect(request.system).toContain("doanh thu fulfillment đã chốt");
    expect(request.system).toContain("Không gọi hai số này là GMV seller");
    expect(request.user).not.toContain("provisionalCosts");
    expect(request.inputSchema.required).not.toContain("sources");
  });

  it("falls back to verified metrics when the model returns an incomplete object", async () => {
    const capability = new OperationsQuestionAnswerCapability(
      { execute: jest.fn(async () => liveContext) } as never,
      {
        generateObject: jest.fn(async () => ({
          value: { limitations: [], suggestedQuestions: [] },
          model: "test-model",
          inputTokens: 10,
          outputTokens: 10,
          estimatedCostUsd: null
        }))
      } as never,
      { contextFor: jest.fn(() => "{\"topic\":\"general\"}") } as never
    );

    const result = await capability.execute("run-1", {
      question: "Tình hình xưởng hôm nay?",
      reportDate: "2026-11-02",
      history: [],
      allowFinancialData: false,
      allowInventoryData: false
    });

    expect(result.output.markdown).toContain("99 đơn");
    expect(result.output.markdown).toContain("57 đơn");
    expect(result.output.markdown).toContain("184 đơn");
  });

  it("routes a multi-day question to the compact period metric tool", async () => {
    const period = {
      range: {
        startDate: "2026-11-03", endDate: "2026-11-09", days: 7,
        timeZone: "UTC", windowStartUtc: "2026-11-03 00:00:00Z", windowEndUtc: "2026-11-10 00:00:00Z"
      },
      totals: {
        orders: 700, items: 850, quantity: 900,
        shipoutOrders: 640, shipoutItems: 780, remakeCases: 4, remakeQuantity: 5
      },
      daily: [],
      source: {
        id: "shop-test", access: "read-only",
        generatedAtUtc: "2026-11-09T07:00:00.000Z",
        dataUpdatedAtUtc: "2026-11-09T06:59:00.000Z"
      }
    };
    const tools = { execute: jest.fn(async () => period) };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      { generateObject: jest.fn(async () => ({
        value: { markdown: "Trong 7 ngày qua có **700 đơn**.", limitations: [], suggestedQuestions: [] },
        model: "test-model", inputTokens: 10, outputTokens: 10, estimatedCostUsd: null
      })) } as never,
      { contextFor: jest.fn(() => "{}") } as never
    );

    const result = await capability.execute("run-period", {
      question: "Số lượng đơn hàng trong 7 ngày qua?",
      reportDate: "2026-11-09",
      history: [],
      allowFinancialData: false,
      allowInventoryData: false
    });

    expect(result.output.markdown).toContain("700 đơn");
    expect(result.output.sources[0].reportDate).toBe("2026-11-03–2026-11-09");
    expect(tools.execute).toHaveBeenCalledWith("run-period", "lemiex.metrics.live-period", {
      startDate: "2026-11-03",
      endDate: "2026-11-09",
      includeFinancials: false
    });
  });

  it("sends image-only questions to vision without loading daily workshop metrics", async () => {
    const tools = { execute: jest.fn() };
    const provider = { generateText: jest.fn(async (request) => ({
      value: "Ảnh có màu đỏ chủ đạo.",
      model: "test-model", inputTokens: 20, outputTokens: 8, estimatedCostUsd: null,
      request
    })) };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      provider as never,
      { contextFor: jest.fn(() => "{}") } as never
    );

    const result = await capability.execute("run-image", {
      question: "Ảnh này có màu gì chủ đạo?",
      reportDate: "2026-11-09",
      history: [],
      allowFinancialData: true,
      allowInventoryData: true
    }, {
      onTextDelta: jest.fn(),
      images: [{ id: "image-1", name: "sample.png", mediaType: "image/png", data: "base64" }]
    });

    expect(result.output.markdown).toContain("màu đỏ");
    expect(result.output.sources[0].label).toContain("Ảnh đính kèm");
    expect(tools.execute).toHaveBeenCalledWith(
      "run-image",
      "lemiex.metrics.inventory",
      { question: "Ảnh này có màu gì chủ đạo?" }
    );
    expect(provider.generateText.mock.calls[0][0].images).toEqual([
      {
        mediaType: "image/png",
        data: "base64",
        label: "Ảnh người dùng tải lên #1. Đây là ảnh cần phân tích."
      }
    ]);
  });

  it("shortlists and visually compares product images with the read-only catalog", async () => {
    const inventory = {
      queryMode: "lookup",
      summary: {
        productCount: 1, variantCount: 1, totalStock: 12, totalReserved: 2,
        totalAvailable: 10, lowStockVariants: 0, outOfStockVariants: 0
      },
      products: [{
        productId: 8, name: "T-Shirt G5000", style: "G5000", brand: "Gildan",
        mockupUrl: "https://catalog.example.test/g5000.png", warehouseName: null,
        methods: ["print"], variantCount: 1, stock: 12, reserved: 2, available: 10,
        pendingDemand: 0
      }],
      matchedProducts: [], matchedVariants: [], exactMatchFound: false,
      source: {
        id: "shop-test", access: "read-only",
        generatedAtUtc: "2026-11-09T07:00:00.000Z",
        dataUpdatedAtUtc: "2026-11-09T06:59:00.000Z"
      }
    };
    const tools = { execute: jest.fn(async () => inventory) };
    const provider = {
      generateObject: jest.fn(async (request: Record<string, unknown>) => ({
        value: {
          isProductImage: true,
          visualDescription: "Áo thun cổ tròn, tay ngắn.",
          candidateProductIds: [8],
          confidence: "high"
        },
        model: "test-model", inputTokens: 25, outputTokens: 10, estimatedCostUsd: 0.001,
        request
      })),
      generateText: jest.fn(async (request) => ({
        value: "Ảnh **khớp cao** với **T-Shirt G5000**.",
        model: "test-model", inputTokens: 50, outputTokens: 15, estimatedCostUsd: 0.002,
        request
      }))
    };
    const productPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(
      new Response(Buffer.from(productPng, "base64"), {
        status: 200,
        headers: { "content-type": "image/png" }
      })
    );
    try {
      const capability = new OperationsQuestionAnswerCapability(
        tools as never,
        provider as never,
        { contextFor: jest.fn(() => "{}") } as never
      );
      const result = await capability.execute("run-product-image", {
        question: "Sản phẩm này có trong xưởng không?",
        reportDate: "2026-11-09",
        history: [],
        allowFinancialData: false,
        allowInventoryData: true
      }, {
        onTextDelta: jest.fn(),
        images: [{ id: "image-1", name: "shirt.png", mediaType: "image/png", data: productPng }]
      });

      expect(tools.execute).toHaveBeenCalledWith(
        "run-product-image", "lemiex.metrics.inventory", { question: "Sản phẩm này có trong xưởng không?" }
      );
      const routingRequest = provider.generateObject.mock.calls[0][0] as {
        images: Array<{ mediaType: string }>;
      };
      expect(routingRequest.images[0].mediaType).toBe("image/webp");
      expect(provider.generateText).not.toHaveBeenCalled();
      expect(result.output.markdown).toContain("khớp xác nhận");
      expect(result.output.markdown).toContain("T-Shirt G5000");
      expect(result.output.answerability.status).toBe("ANSWERED");
      expect(result.generation).toMatchObject({ inputTokens: 25, outputTokens: 10, estimatedCostUsd: 0.001 });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("rejects a number that is absent from verified metrics", async () => {
    const capability = new OperationsQuestionAnswerCapability(
      { execute: jest.fn(async () => liveContext) } as never,
      {
        generateObject: jest.fn(async () => ({
          value: {
            markdown: "Xưởng có **999 đơn**.",
            sources: [],
            limitations: []
          },
          model: "test-model",
          inputTokens: 10,
          outputTokens: 10,
          estimatedCostUsd: null
        }))
      } as never,
      { contextFor: jest.fn(() => "{\"topic\":\"intake\"}") } as never
    );

    await expect(capability.execute("run-1", {
      question: "Có bao nhiêu đơn?",
      reportDate: "2026-11-02",
      history: [],
      allowFinancialData: false,
      allowInventoryData: false
    })).rejects.toThrow("unsupported numbers: 999");
  });

  it("includes approved fulfillment revenue for management questions", async () => {
    const tools = {
      execute: jest.fn(async () => ({
        ...liveContext,
        financialSummary: {
          calculatedFulfillmentFees: 2500,
          confirmedFulfillmentRevenue: 2100,
          basis: "orders created in period",
          currency: "USD"
        }
      }))
    };
    const provider = {
      generateObject: jest.fn(async () => ({
        value: {
          markdown: "Doanh thu fulfillment đã chốt là **2100 USD** trên **99 đơn**.",
          limitations: [],
          suggestedQuestions: []
        },
        model: "test-model",
        inputTokens: 10,
        outputTokens: 10,
        estimatedCostUsd: null
      }))
    };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      provider as never,
      { contextFor: jest.fn(() => "{\"topic\":\"finance\"}") } as never
    );

    const result = await capability.execute("run-1", {
      question: "Doanh thu xưởng hôm nay?",
      reportDate: "2026-11-02",
      history: [],
      allowFinancialData: true,
      allowInventoryData: true
    });

    expect(result.output.markdown).toContain("2100 USD");
    expect(tools.execute).toHaveBeenCalledWith(
      "run-1",
      "lemiex.metrics.live-daily",
      { reportDate: "2026-11-02", includeFinancials: true }
    );
  });

  it("routes inventory questions to the restricted inventory tool", async () => {
    const inventory = {
      queryMode: "lookup" as const,
      summary: {
        productCount: 17,
        variantCount: 845,
        totalStock: 12068,
        totalReserved: 68,
        totalAvailable: 12000,
        lowStockVariants: 5,
        outOfStockVariants: 2
      },
      products: [],
      matchedProducts: [{
        productId: 1,
        name: "Gildan",
        style: "5000",
        brand: "Gildan",
        warehouseName: null,
        methods: ["embroidery"],
        variantCount: 4,
        stock: 120,
        reserved: 20,
        available: 100,
        pendingDemand: 0
      }],
      matchedVariants: [],
      exactMatchFound: true,
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc: "2026-11-03T09:00:00.000Z",
        dataUpdatedAtUtc: "2026-11-03T08:59:00.000Z"
      }
    };
    const tools = { execute: jest.fn(async () => inventory) };
    const provider = {
      generateObject: jest.fn(async () => ({
        value: {
          markdown: "Gildan 5000 còn **100** sản phẩm khả dụng.",
          limitations: [],
          suggestedQuestions: []
        },
        model: "test-model",
        inputTokens: 10,
        outputTokens: 10,
        estimatedCostUsd: null
      }))
    };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      provider as never,
      { contextFor: jest.fn(() => "{\"topic\":\"inventory\"}") } as never
    );

    const result = await capability.execute("run-1", {
      question: "Gildan 5000 trong kho còn bao nhiêu?",
      reportDate: "2026-11-03",
      history: [],
      allowFinancialData: true,
      allowInventoryData: true
    });

    expect(result.output.markdown).toContain("100");
    expect(tools.execute).toHaveBeenCalledTimes(1);
    expect(tools.execute).toHaveBeenCalledWith(
      "run-1",
      "lemiex.metrics.inventory",
      { question: "Gildan 5000 trong kho còn bao nhiêu?" }
    );
  });

  it("does not query inventory for regular users", async () => {
    const tools = { execute: jest.fn() };
    const provider = { generateObject: jest.fn() };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      provider as never,
      { contextFor: jest.fn() } as never
    );

    const result = await capability.execute("run-1", {
      question: "Trong kho còn bao nhiêu sản phẩm?",
      reportDate: "2026-11-03",
      history: [],
      allowFinancialData: false,
      allowInventoryData: false
    });

    expect(result.output.markdown).toContain("chưa được cấp quyền");
    expect(tools.execute).not.toHaveBeenCalled();
    expect(provider.generateObject).not.toHaveBeenCalled();
  });

  it("returns verified order lookup data without asking the model", async () => {
    const lookup = {
      identifiers: ["USLCK4EQK7_577530775113076894"],
      found: true,
      orders: [{
        id: 999150688703,
        refId: "USLCK4EQK7_577530775113076894",
        matchedBy: ["ref_id"],
        seller: { id: 1, username: "felineez", tierName: "Diamond Feline", store: "felineez" },
        orderType: "normal",
        fulfillStatus: "shipped",
        processingStatus: "completed",
        paymentStatus: "paid",
        fulfillmentPriority: "normal",
        items: 1,
        quantity: 1,
        methods: ["print"],
        workflow: [],
        tracking: [],
        financials: { totalCost: 20.5, paidCost: 20.5 },
        createdAt: "2026-11-03 10:00:00",
        updatedAt: "2026-11-03 11:00:00"
      }],
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc: "2026-11-03T12:00:00.000Z",
        dataUpdatedAtUtc: "2026-11-03T11:00:00.000Z"
      }
    };
    const tools = { execute: jest.fn(async () => lookup) };
    const provider = { generateObject: jest.fn() };
    const capability = new OperationsQuestionAnswerCapability(
      tools as never,
      provider as never,
      { contextFor: jest.fn() } as never
    );

    const result = await capability.execute("run-order", {
      question: "Kiểm tra đơn ref_id USLCK4EQK7_577530775113076894",
      reportDate: "2026-11-03",
      history: [],
      allowFinancialData: true,
      allowInventoryData: true,
      allowOrderLookupData: true
    });

    expect(tools.execute).toHaveBeenCalledWith("run-order", "lemiex.search.orders", {
      question: "Kiểm tra đơn ref_id USLCK4EQK7_577530775113076894"
    });
    expect(result.output.markdown).toContain("999150688703");
    expect(result.output.markdown).toContain("Đã xuất hàng");
    expect(provider.generateObject).not.toHaveBeenCalled();
  });

  it("marks a seller fee question without product context as unanswered", async () => {
    const pricing = {
      sellerFound: true,
      seller: { sellerId: 2, username: "simplehub", stores: ["Simple Hub"], tierId: 3, tierName: "Tier 3" },
      productLookupRequested: false,
      productFound: false,
      filters: { color: null, size: null, method: null },
      products: [],
      source: {
        id: "shop-test",
        access: "read-only",
        generatedAtUtc: "2026-11-06T04:00:00.000Z",
        dataUpdatedAtUtc: "2026-11-06T03:59:00.000Z"
      }
    };
    const capability = new OperationsQuestionAnswerCapability(
      { execute: jest.fn(async () => pricing) } as never,
      { generateObject: jest.fn(async () => ({
        value: { markdown: "Vui lòng cung cấp sản phẩm và biến thể.", limitations: [], suggestedQuestions: [] },
        model: "test-model", inputTokens: 10, outputTokens: 10, estimatedCostUsd: null
      })) } as never,
      { contextFor: jest.fn(() => "{}") } as never
    );

    const result = await capability.execute("run-price", {
      question: "Giá Stitch Fees của simplehub",
      reportDate: "2026-11-06",
      history: [],
      allowFinancialData: true,
      allowInventoryData: true,
      allowSellerPricingData: true,
      allowOrderLookupData: true
    });

    expect(result.output.answerability).toMatchObject({
      status: "UNANSWERED",
      reasonCode: "MISSING_PRODUCT_CONTEXT"
    });
  });
});
