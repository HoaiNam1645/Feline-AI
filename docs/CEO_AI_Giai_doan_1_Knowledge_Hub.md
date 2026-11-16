# CEO AI - Giai đoạn 1: Knowledge Hub

## Mục tiêu

Xây kho tri thức nội bộ để CEO AI truy xuất đúng tài liệu, đúng phiên bản hiệu lực và đúng phạm vi phòng ban. Vector search chỉ phục vụ tìm kiếm nội dung; quyền đọc vẫn được kiểm tra bằng dữ liệu phân quyền có cấu trúc.

## Phạm vi đã triển khai

- Tải lên PDF, DOCX, TXT, Markdown, CSV và JSON; giới hạn 15 MB mỗi file.
- Trích xuất văn bản, chia đoạn có chồng lấn và tạo vector cho từng đoạn.
- Quản lý nhiều phiên bản, ngày hiệu lực, ngày hết hiệu lực và trạng thái lập chỉ mục.
- Gắn danh mục, phòng ban sở hữu, người chịu trách nhiệm và mô tả tài liệu.
- Cấp quyền đọc theo phòng ban hoặc toàn công ty.
- Admin quản lý tài liệu; Manager/User chỉ đọc tài liệu đã công bố trong phạm vi phòng ban.
- Tìm kiếm ngữ nghĩa chỉ sử dụng phiên bản hiệu lực mới nhất của từng tài liệu.
- Ghi audit khi tạo, cập nhật, thêm phiên bản, lập chỉ mục lại hoặc xóa dữ liệu mẫu.
- Lưu file gốc lên B2 khi cấu hình lưu trữ khả dụng.

## Dữ liệu tạm thời

Hệ thống tạo sáu tài liệu mẫu ở lần khởi động đầu tiên để kiểm thử toàn bộ luồng. Mỗi tài liệu có cờ `isMock` và được hiển thị rõ là dữ liệu mẫu.

Admin có thể xóa toàn bộ dữ liệu mẫu tại màn `Kho tri thức CEO AI`. Sau khi xóa, audit marker ngăn hệ thống tự tạo lại ở các lần khởi động sau. Khi nhận tài liệu thật, chỉ cần tải lên và đặt trạng thái phù hợp; không phải thay đổi kiến trúc.

## Quy tắc vận hành

1. Tài liệu mới nên ở trạng thái `DRAFT` để kiểm tra nội dung và quyền đọc.
2. Chỉ chuyển sang `PUBLISHED` khi chủ sở hữu xác nhận phiên bản và ngày hiệu lực.
3. Khi có bản mới, tạo version mới thay vì ghi đè file cũ.
4. Tài liệu hết giá trị sử dụng chuyển sang `ARCHIVED`.
5. Tài khoản Manager/User phải có `departmentCode` để nhận đúng phạm vi tài liệu.
6. Vector không được dùng để suy ra quyền phê duyệt, hạn mức hoặc quyền truy cập.

## Thay thế embedding sau này

Giai đoạn dữ liệu giả dùng embedding xác định cục bộ để không phát sinh chi phí và không phụ thuộc nhà cung cấp. Khi có dữ liệu thật, có thể thay `KnowledgeEmbeddingService` bằng dịch vụ embedding production và chạy lập chỉ mục lại; API, tài liệu, phiên bản và quyền đọc giữ nguyên.
