import { Module } from "@nestjs/common";
import { ObservabilityModule } from "../observability/observability.module";
import { AdminAccessController } from "./admin-access.controller";
import { AdminAccessService } from "./admin-access.service";
import { ChatQuestionEvaluationsService } from "./chat-question-evaluations.service";

@Module({
  imports: [ObservabilityModule],
  controllers: [AdminAccessController],
  providers: [AdminAccessService, ChatQuestionEvaluationsService]
})
export class AdminAccessModule {}
