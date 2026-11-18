import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { UserRole, WorkTaskStatus } from "@prisma/client";
import { RequireRoles } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { TasksService } from "./tasks.service";

@Controller("tasks")
@RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Query("status") status?: WorkTaskStatus,
    @Query("department") department?: string,
    @Query("team") team?: string,
    @Query("assignee") assignee?: string,
    @Query("search") search?: string,
    @Query("view") view?: string,
    @Query("dateField") dateField?: string,
    @Query("from") from?: string,
    @Query("to") to?: string
  ) {
    return this.tasks.list(request.auth!, { status, department, team, assignee, search, view, dateField, from, to });
  }

  @Get("summary")
  summary(@Req() request: AuthenticatedRequest, @Query("department") department?: string) {
    return this.tasks.summary(request.auth!, department);
  }

  @Get("assignees")
  assignees(@Req() request: AuthenticatedRequest, @Query("department") department?: string, @Query("team") team?: string) {
    return this.tasks.assignees(request.auth!, department, team);
  }

  @Get("departments")
  departments(@Req() request: AuthenticatedRequest) {
    return this.tasks.departments(request.auth!);
  }

  @Get(":id")
  detail(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasks.detail(request.auth!, id);
  }

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.tasks.create(request.auth!, body);
  }

  @Post("reorder")
  reorder(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.tasks.reorder(request.auth!, body);
  }

  @Patch(":id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.tasks.update(request.auth!, id, body);
  }

  @Post(":id/archive")
  archive(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasks.archive(request.auth!, id);
  }

  @Post(":id/restore")
  restore(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasks.restore(request.auth!, id);
  }

  @Post(":id/claim")
  claim(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasks.claim(request.auth!, id);
  }

  @Post(":id/release")
  release(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.tasks.release(request.auth!, id);
  }

  @Post(":id/updates")
  addUpdate(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.tasks.addUpdate(request.auth!, id, body);
  }

  @Post(":id/checklist")
  addChecklistItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.tasks.addChecklistItem(request.auth!, id, body);
  }

  @Patch(":id/checklist/:itemId")
  updateChecklistItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.tasks.updateChecklistItem(request.auth!, id, itemId, body);
  }

  @Delete(":id/checklist/:itemId")
  removeChecklistItem(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Param("itemId") itemId: string
  ) {
    return this.tasks.removeChecklistItem(request.auth!, id, itemId);
  }
}
