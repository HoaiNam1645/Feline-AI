import { BadRequestException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AccessProfile } from "../auth/access-control";
import { EtsyDashboardData, EtsyDashboardFilters } from "./etsy-data.types";
import { EtsyScopeService } from "./etsy-scope.service";
import { EtsySourceService } from "./etsy-source.service";

@Injectable()
export class EtsyDashboardService {
  constructor(private readonly source: EtsySourceService, private readonly scopes: EtsyScopeService) {}

  get(actor: { role: UserRole; access: AccessProfile }, startDate: string, endDate: string, requested: EtsyDashboardFilters): Promise<EtsyDashboardData> {
    this.assertDate(startDate, "Ngày bắt đầu");
    this.assertDate(endDate, "Ngày kết thúc");
    const days = Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1;
    if (days < 1 || days > 371) throw new BadRequestException("Khoảng thời gian phải từ 1 đến 371 ngày");
    return this.source.dashboard(startDate, endDate, this.scopes.fromActor(actor, requested));
  }

  private assertDate(value: string, label: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "") || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
      throw new BadRequestException(`${label} không hợp lệ`);
    }
  }
}
