import { ArgumentsHost, Catch } from "@nestjs/common";
import { BaseExceptionFilter, HttpAdapterHost } from "@nestjs/core";
import { LoggedRequest, recordRequestError } from "./request-log";

@Catch()
export class RequestErrorFilter extends BaseExceptionFilter {
  constructor(adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === "http") {
      recordRequestError(host.switchToHttp().getRequest<LoggedRequest>(), exception);
    }
    super.catch(exception, host);
  }
}
