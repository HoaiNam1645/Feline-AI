import { Global, Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { requiredNumber, requiredString } from "../config/runtime-config";

@Global()
@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: requiredString("REDIS_HOST", "127.0.0.1"),
        port: requiredNumber("REDIS_PORT", 6379)
      }
    })
  ],
  exports: [BullModule]
})
export class QueueInfrastructureModule {}
