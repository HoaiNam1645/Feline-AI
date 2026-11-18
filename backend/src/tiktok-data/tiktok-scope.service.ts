import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AccessProfile } from "../auth/access-control";
import { TIKTOK_DATA_DOMAINS, TiktokDataDomain, TiktokDataScope } from "./tiktok-data.types";

@Injectable()
export class TiktokScopeService {
  fromActor(actor: { role: UserRole; access: AccessProfile }): TiktokDataScope {
    if (actor.role === UserRole.ADMIN || actor.access.platformAdmin) {
      return {
        unrestricted: true,
        domains: [...TIKTOK_DATA_DOMAINS],
        teamIds: [],
        storeIds: [],
        userIds: []
      };
    }

    const grants = actor.access.grants.filter((grant) =>
      grant.agentId === "tiktok-ai"
      && grant.actions.includes("run")
      && (grant.capabilityIds.includes("*") || grant.capabilityIds.includes("tiktok.data.ask"))
    );
    const values = new Set(grants.flatMap((grant) => grant.dataScopeIds));
    const all = values.has("*") || values.has("tiktok.data.all");
    const hasRowScope = [...values].some((value) =>
      value.startsWith("tiktok.team:")
      || value.startsWith("tiktok.store:")
      || value.startsWith("tiktok.user:")
    );
    const hasExplicitDomain = TIKTOK_DATA_DOMAINS.some((domain) => values.has(`tiktok.data.${domain}`));
    const domains = all
      ? [...TIKTOK_DATA_DOMAINS]
      : hasExplicitDomain
        ? TIKTOK_DATA_DOMAINS.filter((domain) => values.has(`tiktok.data.${domain}`))
        : hasRowScope
          ? [...TIKTOK_DATA_DOMAINS]
          : [];
    const ids = (prefix: string) => [...values]
      .filter((value) => value.startsWith(prefix))
      .map((value) => Number(value.slice(prefix.length)))
      .filter((value) => Number.isSafeInteger(value) && value > 0);

    return {
      unrestricted: all,
      domains,
      teamIds: ids("tiktok.team:"),
      storeIds: ids("tiktok.store:"),
      userIds: ids("tiktok.user:")
    };
  }

  assertDomain(scope: TiktokDataScope, domain: TiktokDataDomain): void {
    if (!scope.domains.includes(domain)) {
      throw new ForbiddenException(`Tài khoản chưa được cấp quyền xem dữ liệu ${domain}`);
    }
    if (!scope.unrestricted && !scope.teamIds.length && !scope.storeIds.length && !scope.userIds.length) {
      throw new ForbiddenException("Tài khoản chưa được cấp phạm vi team, store hoặc seller TikTok");
    }
  }

  orderPredicate(scope: TiktokDataScope, orderAlias = "o"): { sql: string; params: number[] } {
    if (scope.unrestricted) return { sql: "1 = 1", params: [] };
    const conditions: string[] = [];
    const params: number[] = [];
    if (scope.userIds.length) {
      conditions.push(`${orderAlias}.user_id IN (${scope.userIds.map(() => "?").join(",")})`);
      params.push(...scope.userIds);
    }
    if (scope.storeIds.length) {
      conditions.push(`${orderAlias}.shop_code IN (SELECT td_scope.shop_code FROM tiktok_details td_scope WHERE td_scope.store_id IN (${scope.storeIds.map(() => "?").join(",")}))`);
      params.push(...scope.storeIds);
    }
    if (scope.teamIds.length) {
      conditions.push(`${orderAlias}.user_id IN (
        SELECT ud_scope.user_id FROM user_details ud_scope WHERE ud_scope.team_id IN (${scope.teamIds.map(() => "?").join(",")})
        UNION SELECT t_scope.manager_id FROM teams t_scope WHERE t_scope.id IN (${scope.teamIds.map(() => "?").join(",")})
      )`);
      params.push(...scope.teamIds, ...scope.teamIds);
    }
    return { sql: conditions.length ? `(${conditions.join(" OR ")})` : "0 = 1", params };
  }

  storePredicate(scope: TiktokDataScope, storeAlias = "s"): { sql: string; params: number[] } {
    if (scope.unrestricted) return { sql: "1 = 1", params: [] };
    const conditions: string[] = [];
    const params: number[] = [];
    if (scope.storeIds.length) {
      conditions.push(`${storeAlias}.id IN (${scope.storeIds.map(() => "?").join(",")})`);
      params.push(...scope.storeIds);
    }
    if (scope.userIds.length) {
      conditions.push(`${storeAlias}.user_id IN (${scope.userIds.map(() => "?").join(",")})`);
      params.push(...scope.userIds);
    }
    if (scope.teamIds.length) {
      conditions.push(`${storeAlias}.user_id IN (
        SELECT ud_scope.user_id FROM user_details ud_scope WHERE ud_scope.team_id IN (${scope.teamIds.map(() => "?").join(",")})
        UNION SELECT t_scope.manager_id FROM teams t_scope WHERE t_scope.id IN (${scope.teamIds.map(() => "?").join(",")})
      )`);
      params.push(...scope.teamIds, ...scope.teamIds);
    }
    return { sql: conditions.length ? `(${conditions.join(" OR ")})` : "0 = 1", params };
  }
}
