import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { readCookie, requestMetadata, sessionCookie } from "./auth-http";
import { Public } from "./access-control";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  async login(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.auth.login(body.email, body.password, requestMetadata(request));
    response.setHeader("Set-Cookie", sessionCookie(
      this.auth.cookieName(),
      result.token,
      this.auth.sessionTtlSeconds(),
      this.auth.cookieSecure()
    ));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = readCookie(request, this.auth.cookieName());
    await this.auth.logout(token, requestMetadata(request));
    response.setHeader("Set-Cookie", sessionCookie(
      this.auth.cookieName(), "", 0, this.auth.cookieSecure()
    ));
    return { success: true };
  }

  @Post("refresh")
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.refresh(
      readCookie(request, this.auth.cookieName()),
      requestMetadata(request)
    );
    response.setHeader("Set-Cookie", sessionCookie(
      this.auth.cookieName(), result.token, this.auth.sessionTtlSeconds(), this.auth.cookieSecure()
    ));
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Get("me")
  async me(@Req() request: Request) {
    const session = await this.auth.authenticate(readCookie(request, this.auth.cookieName()));
    return { user: session.user, access: session.access };
  }

  @Post("change-password")
  async changePassword(
    @Body() body: Record<string, unknown>,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response
  ) {
    await this.auth.changePassword(
      readCookie(request, this.auth.cookieName()),
      body.currentPassword,
      body.newPassword,
      requestMetadata(request)
    );
    response.setHeader("Set-Cookie", sessionCookie(
      this.auth.cookieName(), "", 0, this.auth.cookieSecure()
    ));
    return { success: true, reauthenticationRequired: true };
  }
}
