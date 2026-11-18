import { Controller, Get, Param, Patch, Query, Req } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { RequireRoles } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query("limit") limit?: string) {
    return this.notifications.list(request.auth!, limit);
  }

  @Get("unread-count")
  unreadCount(@Req() request: AuthenticatedRequest) {
    return this.notifications.unreadCount(request.auth!);
  }

  @Patch("read-all")
  readAll(@Req() request: AuthenticatedRequest) {
    return this.notifications.markAllRead(request.auth!);
  }

  @Patch(":id/read")
  read(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.notifications.markRead(request.auth!, id);
  }
}
