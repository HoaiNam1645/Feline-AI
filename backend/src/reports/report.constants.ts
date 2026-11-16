import { requiredString } from "../config/runtime-config";

export const REPORT_QUEUE = requiredString(
  "REPORT_QUEUE_NAME",
  "workshop-daily-report"
);
export const GENERATE_DAILY_REPORT_JOB = "generate-daily-report";
