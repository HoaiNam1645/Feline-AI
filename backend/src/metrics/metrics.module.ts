import { Module } from "@nestjs/common";
import { WorkshopMetricsController } from "./workshop-metrics.controller";
import { WorkshopMetricsService } from "./workshop-metrics.service";

@Module({
  controllers: [WorkshopMetricsController],
  providers: [WorkshopMetricsService],
  exports: [WorkshopMetricsService]
})
export class MetricsModule {}
