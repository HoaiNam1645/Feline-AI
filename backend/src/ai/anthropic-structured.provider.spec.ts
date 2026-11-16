import { partialJsonString } from "./anthropic-structured.provider";

describe("partialJsonString", () => {
  it("reads an unfinished JSON string for model streaming", () => {
    expect(partialJsonString('{"markdown":"Xin chào', "markdown")).toBe("Xin chào");
  });

  it("decodes completed escapes and ignores an unfinished escape", () => {
    expect(partialJsonString('{"markdown":"Dòng 1\\nDòng 2\\', "markdown"))
      .toBe("Dòng 1\nDòng 2");
  });

  it("returns the completed markdown when other fields follow", () => {
    expect(partialJsonString('{"markdown":"**Xong**","limitations":[]}', "markdown"))
      .toBe("**Xong**");
  });
});
