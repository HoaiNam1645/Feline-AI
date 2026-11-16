import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DatabaseModule } from "./database/database.module";
import { MetricsModule } from "./metrics/metrics.module";
import { QueueInfrastructureModule } from "./queue/queue.module";
import { ReportWorkerModule } from "./reports/report-worker.module";
import { SourceModule } from "./source/source.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    SourceModule,
    QueueInfrastructureModule,
    MetricsModule,
    ReportWorkerModule
  ]
})
export class WorkerModule {}
