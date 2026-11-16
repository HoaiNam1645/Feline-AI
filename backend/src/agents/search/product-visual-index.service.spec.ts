import { ProductVisualIndexService, type ProductVisualDescriptor } from "./product-visual-index.service";

describe("ProductVisualIndexService", () => {
  const service = new ProductVisualIndexService({} as never, {} as never, {} as never);
  const score = (left: ProductVisualDescriptor, right: ProductVisualDescriptor) =>
    (service as unknown as { similarity: (a: ProductVisualDescriptor, b: ProductVisualDescriptor) => number })
      .similarity(left, right);

  it("ranks by visual identity instead of generic product wording", () => {
    const query: ProductVisualDescriptor = {
      category: "pet accessory",
      objectType: "bone shaped knitted dog toy",
      shape: ["dog bone", "elongated center", "rounded ends"],
      materials: ["cable knit fabric", "soft textile"],
      constructionFeatures: ["stuffed", "hanging loop"],
      functionalFeatures: ["pet toy", "hanging ornament"],
      visualAliases: ["bone toy", "dog bone ornament", "knitted pet toy"],
      colors: ["cream"],
      visibleText: []
    };
    const matching: ProductVisualDescriptor = {
      category: "pet accessory",
      objectType: "knitted dog bone ornament",
      shape: ["dog bone", "rounded ends"],
      materials: ["cable knit", "fabric"],
      constructionFeatures: ["stuffed body", "hanging loop"],
      functionalFeatures: ["pet toy", "christmas ornament"],
      visualAliases: ["dog bone toy", "bone shaped ornament"],
      colors: ["ivory"],
      visibleText: []
    };
    const unrelated: ProductVisualDescriptor = {
      category: "bag",
      objectType: "zippered makeup bag",
      shape: ["rectangular pouch"],
      materials: ["canvas"],
      constructionFeatures: ["zipper", "flat bottom"],
      functionalFeatures: ["cosmetic storage"],
      visualAliases: ["makeup pouch", "toiletry bag"],
      colors: ["cream"],
      visibleText: []
    };

    expect(score(query, matching)).toBeGreaterThan(score(query, unrelated) * 3);
  });
});
