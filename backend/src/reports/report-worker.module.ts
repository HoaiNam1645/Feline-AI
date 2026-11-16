import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AgentsModule } from "../agents/agents.module";
import { MetricsModule } from "../metrics/metrics.module";
import { ReportEngineModule } from "../report-engine/report-engine.module";
import { REPORT_QUEUE } from "./report.constants";
import { ReportProcessor } from "./report.processor";

@Module({
  imports: [
    BullModule.registerQueue({ name: REPORT_QUEUE }),
    AgentsModule,
    MetricsModule,
    ReportEngineModule
  ],
  providers: [ReportProcessor]
})
export class ReportWorkerModule {}
