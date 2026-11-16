import { initializeRequestLog, recordRequestError } from "./request-log";

describe("request logging helpers", () => {
  it("assigns a unique request id and captures diagnostic error details", () => {
    const request = {} as never;
    const context = initializeRequestLog(request);
    const error = Object.assign(new Error("Database unavailable"), { code: "P1001" });

    recordRequestError(request, error);

    expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect(context.error).toMatchObject({
      name: "Error",
      code: "P1001",
      message: "Database unavailable"
    });
    expect(context.error?.stack).toContain("Database unavailable");
  });
});
