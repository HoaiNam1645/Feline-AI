import { Injectable, OnModuleInit } from "@nestjs/common";
import { KnowledgeDocumentStatus } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { KnowledgeHubService } from "./knowledge-hub.service";

@Injectable()
export class KnowledgeMockSeederService implements OnModuleInit {
  constructor(
    private readonly knowledge: KnowledgeHubService,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === "test" || process.env.KNOWLEDGE_MOCK_SEED_ENABLED === "false") return;
    const [documentCount, removedMarker] = await Promise.all([
      this.prisma.knowledgeDocument.count(),
      this.prisma.accessAuditEvent.findFirst({
        where: { eventType: "KNOWLEDGE_MOCK_REMOVED" },
        select: { id: true }
      })
    ]);
    if (documentCount > 0 || removedMarker) return;
    for (const item of this.documents()) {
      await this.knowledge.createMockDocument(item.meta, item.content);
    }
  }

  private documents() {
    const common = { status: KnowledgeDocumentStatus.PUBLISHED, effectiveFrom: new Date("2026-01-01T00:00:00+07:00"), isMock: true };
    return [
      {
        meta: { ...common, title: "Nội quy làm việc mẫu", category: "Nội quy", description: "Dữ liệu mẫu chờ tài liệu chính thức.", ownerDepartmentCode: "HR", ownerDepartmentName: "Nhân sự", ownerName: "Trưởng phòng Nhân sự", allowedDepartments: ["ALL"] },
        content: "NỘI QUY LÀM VIỆC MẪU\n\nThời gian làm việc tiêu chuẩn từ thứ Hai đến thứ Bảy theo lịch của từng bộ phận. Nhân sự phải chấm công khi bắt đầu và kết thúc ca. Trường hợp đi muộn, về sớm hoặc quên chấm công cần thông báo quản lý trực tiếp và bộ phận Nhân sự trong ngày.\n\nNhân viên có trách nhiệm bảo mật dữ liệu khách hàng, dữ liệu nội bộ và thông tin tài khoản được cấp. Không chia sẻ mật khẩu hoặc dữ liệu nhạy cảm qua kênh không được công ty phê duyệt."
      },
      {
        meta: { ...common, title: "Chính sách nghỉ phép mẫu", category: "Nhân sự", description: "Quy tắc nghỉ phép minh họa để kiểm thử RAG.", ownerDepartmentCode: "HR", ownerDepartmentName: "Nhân sự", ownerName: "HR Manager", allowedDepartments: ["ALL"] },
        content: "CHÍNH SÁCH NGHỈ PHÉP MẪU\n\nNhân viên gửi yêu cầu nghỉ phép cho quản lý trực tiếp, nêu ngày nghỉ, loại phép, lý do và người nhận bàn giao. Nghỉ có kế hoạch nên được gửi trước ít nhất hai ngày làm việc. Trường hợp khẩn cấp cần thông báo ngay khi có thể.\n\nQuản lý trực tiếp xem xét lịch nhân sự và việc bàn giao trước khi phản hồi. Bộ phận Nhân sự kiểm tra số dư phép và lưu trạng thái cuối cùng. Đây là dữ liệu mẫu, chưa phải chính sách chính thức."
      },
      {
        meta: { ...common, title: "Quy trình tạm ứng và hoàn ứng mẫu", category: "Tài chính", description: "Quy trình minh họa cho yêu cầu nội bộ.", ownerDepartmentCode: "FINANCE", ownerDepartmentName: "Tài chính", ownerName: "Kế toán trưởng", allowedDepartments: ["ALL"] },
        content: "QUY TRÌNH TẠM ỨNG VÀ HOÀN ỨNG MẪU\n\nYêu cầu tạm ứng cần có người đề nghị, mục đích sử dụng, số tiền, thời gian cần và đơn vị chịu chi phí. Người quản lý xác nhận nhu cầu trước khi chuyển bộ phận Tài chính kiểm tra.\n\nKhi hoàn ứng, người đề nghị cung cấp chứng từ phù hợp và đối chiếu với yêu cầu ban đầu. Trường hợp thiếu chứng từ phải bổ sung hoặc được người có thẩm quyền xác nhận ngoại lệ. CEO AI chỉ tư vấn và chuyển đúng người xử lý, không xác nhận đã duyệt."
      },
      {
        meta: { ...common, title: "Quy trình mua sắm nội bộ mẫu", category: "Mua sắm", description: "Tài liệu mẫu cho Operations và Management.", ownerDepartmentCode: "OPERATIONS", ownerDepartmentName: "Vận hành", ownerName: "Operations Manager", allowedDepartments: ["OPERATIONS", "MANAGEMENT"] },
        content: "QUY TRÌNH MUA SẮM NỘI BỘ MẪU\n\nĐề xuất mua sắm cần mô tả nhu cầu, số lượng, thời điểm cần, bộ phận sử dụng và báo giá nếu có. Quản lý bộ phận xác nhận nhu cầu và mức độ ưu tiên. Bộ phận phụ trách mua sắm kiểm tra nhà cung cấp, điều kiện giao hàng và tổng chi phí.\n\nCác trường hợp khẩn cấp vẫn phải ghi lại lý do, người quyết định và kết quả thực hiện để kiểm tra sau."
      },
      {
        meta: { ...common, title: "Danh sách đầu mối xử lý mẫu", category: "Cơ cấu tổ chức", description: "Danh bạ vai trò minh họa.", ownerDepartmentCode: "HR", ownerDepartmentName: "Nhân sự", ownerName: "HR Admin", allowedDepartments: ["ALL"] },
        content: "DANH SÁCH ĐẦU MỐI MẪU\n\nNhân sự: tiếp nhận câu hỏi nội quy, phép, chấm công và hồ sơ nhân viên. Quản lý trực tiếp: xác nhận lịch làm việc, bàn giao và nhu cầu của bộ phận. Tài chính: kiểm tra tạm ứng, hoàn ứng, hóa đơn và nguồn chi phí. Vận hành: xử lý mua sắm phục vụ hoạt động và điều phối nguồn lực. Ban quản lý: quyết định trường hợp ngoại lệ hoặc ảnh hưởng nhiều bộ phận."
      },
      {
        meta: { ...common, title: "Nguyên tắc điều hành mẫu", category: "Lãnh đạo", description: "Hồ sơ mẫu sẽ được thay bằng kết quả khảo sát của lãnh đạo.", ownerDepartmentCode: "MANAGEMENT", ownerDepartmentName: "Ban quản lý", ownerName: "CEO", allowedDepartments: ["MANAGEMENT", "HR"] },
        content: "NGUYÊN TẮC ĐIỀU HÀNH MẪU\n\nƯu tiên xử lý vấn đề dựa trên tác động đến khách hàng, vận hành, con người và dòng tiền. Với quyết định dễ sửa sai, có thể thử trong phạm vi nhỏ và đặt mốc đánh giá. Với quyết định khó đảo ngược, cần dữ liệu, người chịu trách nhiệm và phương án dự phòng.\n\nKhi thông tin chưa đủ, cần nói rõ phần còn thiếu và hỏi bổ sung thay vì đoán. Ví dụ lịch sử chỉ dùng để tham khảo cách suy nghĩ, không tự trở thành chính sách hoặc quyền phê duyệt."
      }
    ];
  }
}
