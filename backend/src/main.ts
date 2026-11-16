import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { requiredNumber } from "./config/runtime-config";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(requiredNumber("PORT", 3000), "0.0.0.0");
}

void bootstrap();
