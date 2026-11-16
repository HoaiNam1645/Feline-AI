import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { RequestErrorFilter } from "./request-error.filter";
import { RequestLoggingMiddleware } from "./request-logging.middleware";
import { RequestLogsService } from "./request-logs.service";

@Module({
  providers: [
    RequestLoggingMiddleware,
    RequestLogsService,
    { provide: APP_FILTER, useClass: RequestErrorFilter }
  ],
  exports: [RequestLoggingMiddleware, RequestLogsService]
})
export class ObservabilityModule {}
