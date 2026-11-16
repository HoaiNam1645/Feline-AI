import { Module } from "@nestjs/common";
import { MetricsModule } from "../metrics/metrics.module";
import { OfficeDelegationService } from "./office-delegation.service";
import { OfficeController } from "./office.controller";

@Module({
  imports: [MetricsModule],
  controllers: [OfficeController],
  providers: [OfficeDelegationService]
})
export class OfficeModule {}
