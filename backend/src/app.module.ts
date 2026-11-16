import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AgentsModule } from "./agents/agents.module";
import { KnowledgeDelegationModule } from "./agents/delegation/knowledge-delegation.module";
import { AdminAccessModule } from "./admin/admin-access.module";
import { AuthModule } from "./auth/auth.module";
import { ChatModule } from "./chat/chat.module";
import { CeoChatModule } from "./ceo-chat/ceo-chat.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { MetricsModule } from "./metrics/metrics.module";
import { KnowledgeModule } from "./knowledge/knowledge.module";
import { AiOperationsModule } from "./operations/ai-operations.module";
import { ObservabilityModule } from "./observability/observability.module";
import { OfficeModule } from "./office/office.module";
import { RequestLoggingMiddleware } from "./observability/request-logging.middleware";
import { QueueInfrastructureModule } from "./queue/queue.module";
import { ReportEngineModule } from "./report-engine/report-engine.module";
import { ReportProducerModule } from "./reports/report-producer.module";
import { SourceModule } from "./source/source.module";
import { TiktokChatModule } from "./tiktok-chat/tiktok-chat.module";
import { TiktokDataModule } from "./tiktok-data/tiktok-data.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    AdminAccessModule,
    AgentsModule,
    KnowledgeDelegationModule,
    ChatModule,
    CeoChatModule,
    TiktokChatModule,
    TiktokDataModule,
    KnowledgeModule,
    DatabaseModule,
    ObservabilityModule,
    AiOperationsModule,
    OfficeModule,
    SourceModule,
    QueueInfrastructureModule,
    HealthModule,
    MetricsModule,
    ReportEngineModule,
    ReportProducerModule
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes("*");
  }
}
