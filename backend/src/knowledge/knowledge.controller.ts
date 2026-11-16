import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { RequireRoles } from "../auth/access-control";
import { AuthenticatedRequest } from "../auth/access.guard";
import { KnowledgeHubService } from "./knowledge-hub.service";

@Controller("knowledge")
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeHubService) {}

  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Get("documents")
  list(@Req() request: AuthenticatedRequest, @Query() query: Record<string, unknown>) {
    return this.knowledge.list(this.actor(request), query);
  }

  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Get("documents/:id")
  detail(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.knowledge.detail(this.actor(request), id);
  }

  @RequireRoles(UserRole.ADMIN, UserRole.MANAGER, UserRole.USER)
  @Post("search")
  search(@Req() request: AuthenticatedRequest, @Body() body: Record<string, unknown>) {
    return this.knowledge.search(this.actor(request), body);
  }

  @RequireRoles(UserRole.ADMIN)
  @Post("documents")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.knowledge.createFromUpload(request.auth!.user.id, body, file);
  }

  @RequireRoles(UserRole.ADMIN)
  @Post("documents/:id/versions")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 15 * 1024 * 1024, files: 1 } }))
  addVersion(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @UploadedFile() file?: Express.Multer.File
  ) {
    return this.knowledge.addVersion(request.auth!.user.id, id, body, file);
  }

  @RequireRoles(UserRole.ADMIN)
  @Patch("documents/:id")
  update(
    @Req() request: AuthenticatedRequest,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>
  ) {
    return this.knowledge.updateMetadata(request.auth!.user.id, id, body);
  }

  @RequireRoles(UserRole.ADMIN)
  @Post("documents/:id/reindex")
  reindex(@Req() request: AuthenticatedRequest, @Param("id") id: string) {
    return this.knowledge.reindex(request.auth!.user.id, id);
  }

  @RequireRoles(UserRole.ADMIN)
  @Delete("mock-documents")
  removeMock(@Req() request: AuthenticatedRequest, @Query("agentId") agentId?: string) {
    return this.knowledge.removeMockDocuments(request.auth!.user.id, agentId);
  }

  private actor(request: AuthenticatedRequest) {
    return {
      id: request.auth!.user.id,
      role: request.auth!.user.role,
      departmentCode: request.auth!.user.departmentCode,
      agentIds: request.auth!.access.platformAdmin
        ? undefined
        : request.auth!.access.grants
          .filter((grant) => grant.actions.includes("view"))
          .map((grant) => grant.agentId)
    };
  }
}
