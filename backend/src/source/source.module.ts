import { Global, Module } from "@nestjs/common";
import { SourceMysqlService } from "./source-mysql.service";

@Global()
@Module({
  providers: [SourceMysqlService],
  exports: [SourceMysqlService]
})
export class SourceModule {}
