const REPORT_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ReportWindow {
  reportDate: string;
  timeZone: "UTC";
  startUtc: string;
  endUtc: string;
}

function assertDateParts(reportDate: string): void {
  if (!REPORT_DATE_PATTERN.test(reportDate)) {
    throw new Error("reportDate must use YYYY-MM-DD");
  }

  const parsed = new Date(`${reportDate}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== reportDate) {
    throw new Error("reportDate is not a valid calendar date");
  }
}

export function reportWindow(reportDate: string): ReportWindow {
  assertDateParts(reportDate);
  const start = new Date(`${reportDate}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return {
    reportDate,
    timeZone: "UTC",
    startUtc: start.toISOString().slice(0, 19).replace("T", " "),
    endUtc: end.toISOString().slice(0, 19).replace("T", " ")
  };
}

export function shiftReportDate(reportDate: string, days: number): string {
  assertDateParts(reportDate);
  const date = new Date(`${reportDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
