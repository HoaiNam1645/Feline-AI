import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Cron } from "@nestjs/schedule";
import { Queue } from "bullmq";
import { requiredString } from "../config/runtime-config";
import {
  GENERATE_DAILY_REPORT_JOB,
  REPORT_QUEUE
} from "./report.constants";
import { previousLocalDate } from "./report-date";

@Injectable()
export class ReportScheduler {
  private readonly logger = new Logger(ReportScheduler.name);

  constructor(@InjectQueue(REPORT_QUEUE) private readonly queue: Queue) {}

  @Cron("0 0 0 * * *", {
    name: "workshop-daily-report-extract",
    timeZone: "Asia/Ho_Chi_Minh"
  })
  async scheduleDailyReport(): Promise<void> {
    if (process.env.SCHEDULER_ENABLED !== "true") return;

    const timeZone = requiredString(
      "REPORT_TIME_ZONE",
      "Asia/Ho_Chi_Minh"
    );
    const reportDate = previousLocalDate(new Date(), timeZone);

    await this.queue.add(
      GENERATE_DAILY_REPORT_JOB,
      { reportDate, timeZone },
      {
        jobId: `workshop-daily-${reportDate}`,
        attempts: 4,
        backoff: { type: "exponential", delay: 300_000 },
        removeOnComplete: 1000,
        removeOnFail: 1000
      }
    );
    this.logger.log(`Queued report for ${reportDate}`);
  }
}
