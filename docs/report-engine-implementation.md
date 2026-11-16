# Report Engine - workshop-daily-v0.1

**Ngày hoàn thành:** 30/10/2026  
**Đầu vào:** `MetricSnapshot` trong PostgreSQL  
**Đầu ra:** `ReportArtifact` sẵn sàng gửi Telegram

## Nguyên tắc

- Toàn bộ con số do code lấy từ snapshot; không gọi AI để tạo hoặc sửa số liệu.
- Không truy vấn MySQL trong bước render.
- Không hiển thị chi phí tạm tính khi công thức chưa được chốt.
- Chỉ hiển thị tuổi backlog, không tự gắn nhãn trễ SLA.
- Không đưa PII vào nội dung báo cáo.
- Giới hạn an toàn 3.900 ký tự, thấp hơn giới hạn một tin nhắn Telegram.

## Nội dung báo cáo

1. Tiếp nhận: đơn, item, quantity, phương pháp, loại đơn và ưu tiên.
2. So sánh với hôm trước và cùng thứ tuần trước.
3. Hoàn tất staff, QC, packing và shipout.
4. Backlog theo trạng thái, tuổi đơn và thanh toán.
5. Hủy/refund/remake đã xác nhận được.
6. Nhận xét số học deterministic.
7. Cảnh báo chất lượng dữ liệu.

Phần “nhận xét từ số liệu” hiện chỉ dùng các quy tắc rõ ràng như tăng/giảm, chênh lệch shipout với tiếp nhận và backlog trên 72 giờ. Đây chưa phải phần nhận xét của AI Agent.

## State machine đã chạy

```text
SNAPSHOT_SAVED
  -> RENDERING
  -> READY_TO_SEND
```

Mỗi lần chuyển trạng thái được lưu trong `AuditEvent`. Nội dung, template version và metadata được lưu trong `ReportArtifact` theo khóa duy nhất của lần chạy.

## Kết quả chạy thật ngày 29/10/2026

- Template: `workshop-daily-v0.1`.
- Độ dài: 1.417 ký tự.
- Trạng thái: `READY_TO_SEND`.
- Model AI: `NULL` - chưa gọi model.
- Báo cáo chứa 99 đơn mới, 112 item và 158 đơn shipout.
- Backlog tại lần render: 184 đơn; 57 đơn từ 72 giờ trở lên.
- Không hiển thị `provisionalCosts`.

## Endpoint nội bộ

```text
GET /reports/workshop/daily/YYYY-MM-DD
```

Endpoint đọc snapshot/artifact từ PostgreSQL và trả về trạng thái, template version, số ký tự cùng nội dung báo cáo. API hiện chỉ bind vào `127.0.0.1`.

