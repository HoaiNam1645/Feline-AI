import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { ScheduleModule } from "@nestjs/schedule";
import { REPORT_QUEUE } from "./report.constants";
import { ReportScheduler } from "./report.scheduler";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    BullModule.registerQueue({ name: REPORT_QUEUE })
  ],
  providers: [ReportScheduler]
})
export class ReportProducerModule {}
