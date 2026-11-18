import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AccessProfile } from "../auth/access-control";
import { EtsyDashboardFilters } from "./etsy-data.types";

@Injectable()
export class EtsyScopeService {
  fromActor(actor: { role: UserRole; access: AccessProfile }, requested: EtsyDashboardFilters): EtsyDashboardFilters {
    if (actor.role === UserRole.ADMIN || actor.access.platformAdmin) return requested;
    const grants = actor.access.grants.filter((grant) =>
      grant.agentId === "etsy-ai"
      && grant.actions.some((action) => action === "view" || action === "run")
      && (grant.capabilityIds.includes("*") || grant.capabilityIds.includes("etsy.data.ask"))
    );
    const scopes = new Set(grants.flatMap((grant) => grant.dataScopeIds));
    const unrestricted = scopes.has("*") || scopes.has("etsy.workspace.all");
    if (unrestricted) return requested;

    const allowedTeams = this.ids(scopes, "etsy.team:");
    const allowedShops = this.ids(scopes, "etsy.shop:");
    const allowedSellers = this.ids(scopes, "etsy.seller:");
    if (!allowedTeams.length && !allowedShops.length && !allowedSellers.length) {
      throw new ForbiddenException("Tài khoản chưa được cấp phạm vi dữ liệu Etsy");
    }
    return {
      sellerTeamIds: this.intersectOrAllowed(requested.sellerTeamIds, allowedTeams),
      shopIds: this.intersectOrAllowed(requested.shopIds, allowedShops),
      sellerIds: this.intersectOrAllowed(requested.sellerIds, allowedSellers)
    };
  }

  private ids(scopes: Set<string>, prefix: string): string[] {
    return [...scopes].filter((value) => value.startsWith(prefix)).map((value) => value.slice(prefix.length)).filter(Boolean);
  }

  private intersectOrAllowed(requested: string[], allowed: string[]): string[] {
    if (!allowed.length) return [];
    if (!requested.length) return allowed;
    const result = requested.filter((id) => allowed.includes(id));
    if (!result.length) throw new ForbiddenException("Phạm vi dữ liệu Etsy được chọn không thuộc quyền truy cập");
    return result;
  }
}
