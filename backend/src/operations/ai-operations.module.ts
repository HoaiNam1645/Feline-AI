import { Global, Module } from "@nestjs/common";
import { AiOperationsControlService } from "./ai-operations-control.service";

@Global()
@Module({
  providers: [AiOperationsControlService],
  exports: [AiOperationsControlService]
})
export class AiOperationsModule {}
