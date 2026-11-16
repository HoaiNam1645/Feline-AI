# Văn phòng AI liên công ty

## Phạm vi đang chạy

- Feline AI và Lemiex AI là hai không gian 3D tách biệt.
- Feline hiện có Phòng Giám đốc; Lemiex có khu vận hành xưởng.
- Tài khoản chỉ mở được Văn phòng AI khi đồng thời có quyền chạy CEO AI và đọc dữ liệu vận hành Lemiex.
- Năng lực đầu tiên là hỏi số đơn Lemiex theo ngày, gồm hôm nay, hôm qua, `YYYY-MM-DD` và `DD/MM/YYYY`.
- Kết quả lấy trực tiếp từ Metrics Engine qua kết nối shop-test chỉ đọc, không dùng dữ liệu giả.

## Luồng xử lý

1. Frontend gửi câu hỏi tới `POST /office/delegations/stream`.
2. Access Guard kiểm tra quyền chạy CEO AI.
3. Office Delegation kiểm tra thêm quyền đọc `lemiex.operations.basic`.
4. Router bằng code xác định câu hỏi số đơn và ngày báo cáo.
5. Backend tạo `AgentRun`, ghi audit `OFFICE_DELEGATION_DISPATCHED` và gọi `WorkshopMetricsService`.
6. Backend stream trạng thái; giao diện đồng bộ hoạt cảnh đi, xử lý, nhận báo cáo và quay về.
7. Khi có kết quả, backend hoàn tất `AgentRun`, ghi `OFFICE_DELEGATION_COMPLETED` và trả dữ liệu có cấu trúc.

## Nguyên tắc an toàn

- Cảnh 3D không quyết định quyền và không tự tạo dữ liệu.
- CEO AI không kết nối trực tiếp vào MySQL; dữ liệu đi qua capability của Lemiex.
- Kết nối nguồn dùng tài khoản `feline_ai_ro`, TLS và chỉ có quyền `SELECT`.
- Mỗi tài khoản chỉ được chạy một nhiệm vụ cùng capability tại một thời điểm.
- Mọi lần chuyển việc, hoàn tất, bị từ chối hoặc thất bại đều có audit.
- Luồng số đơn không gọi model nên `inputTokens` và `outputTokens` bằng `0`.

## Mở rộng

Mỗi năng lực mới nên bổ sung một router và capability riêng, ví dụ:

- `ceo.delegate.lemiex.revenue`
- `ceo.delegate.lemiex.backlog`
- `ceo.delegate.lemiex.order-lookup`
- `ceo.delegate.lemiex.inventory`

Không mở quyền tổng quát từ CEO AI vào toàn bộ dữ liệu Lemiex. Mỗi capability phải khai báo data scope, đầu ra có cấu trúc và audit riêng.
