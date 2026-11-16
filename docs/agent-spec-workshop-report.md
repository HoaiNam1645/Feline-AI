# Agent Spec - Workshop Daily Report

**Agent ID:** `workshop-daily-report`  
**Mức quyền:** R0 - chỉ đọc và báo cáo  
**Phạm vi:** Giai đoạn 1A  
**Kênh đầu ra:** Telegram group quản lý

## 1. Mục tiêu

Tự động tổng hợp tình hình vận hành xưởng Lemiex hằng ngày từ `shop-test`, gửi lúc 08:00 giờ Việt Nam và đảm bảo mọi con số truy ngược được về snapshot metric đã lưu.

Agent không điều khiển sản xuất, không sửa dữ liệu nguồn, không tự viết SQL, không gửi PII và không kết luận nguyên nhân khi dữ liệu không đủ.

## 2. Đầu vào và đầu ra

### Đầu vào

- Snapshot KPI do Metrics Engine tính theo `docs/metric-spec-mvp.md`.
- Tình trạng dữ liệu và danh sách metric lỗi/thiếu.
- So sánh với ngày trước và cùng thứ tuần trước khi snapshot lịch sử đã tồn tại.

### Đầu ra

- Báo cáo Telegram theo template cố định.
- Nhận xét AI ngắn, chỉ dựa trên JSON metric đầu vào.
- Bản ghi audit gồm metric snapshot, phiên bản spec, prompt/model, nội dung gửi, token/chi phí, delivery ID và lỗi/retry.

## 3. Lịch chạy

| Giờ Việt Nam | Job |
|---|---|
| 06:00 | Đọc nguồn, kiểm tra độ tươi và tạo snapshot KPI |
| 07:30 | Validate snapshot, render phần số liệu và tạo nhận xét AI |
| 08:00 | Gửi Telegram bằng idempotency key |

Retry đề xuất: sau 5, 15 và 30 phút. Nếu Claude lỗi hoặc vượt ngân sách, vẫn gửi báo cáo số liệu không có nhận xét AI.

## 4. Quy tắc tạo nội dung

- Code/template dựng toàn bộ số liệu; model không được tạo hoặc sửa con số.
- Model chỉ nhận JSON tổng hợp đã loại PII.
- Nhận xét tách rõ `Dữ liệu cho thấy` và `Cần kiểm tra`.
- Không dùng các cụm khẳng định nguyên nhân như “do”, “chắc chắn”, “nhân viên gây ra” nếu metric không chứng minh được.
- SLA, refund và chi phí chưa chốt phải hiển thị nhãn `tạm thời` hoặc bị ẩn.
- Tối đa đề xuất ba việc cần kiểm tra, ưu tiên backlog lâu và dữ liệu bất thường.

## 5. State machine của một lần chạy

```text
scheduled
  -> extracting
  -> validating
  -> snapshot_saved
  -> rendering
  -> ready_to_send
  -> sending
  -> sent

Mọi bước có thể -> retry_wait -> bước lỗi trước đó.
Hết retry -> failed_alerted.
Snapshot thiếu một phần -> degraded_ready -> sent_degraded.
```

Các chuyển trạng thái phải ghi timestamp, attempt, lỗi đã rút gọn và correlation ID. Job khởi động lại phải tiếp tục từ trạng thái bền vững gần nhất, không gửi trùng.

## 6. Kiểm soát an toàn

- Tài khoản nguồn chỉ có `SELECT` trên view/bảng đã duyệt.
- Không đưa các cột tên, điện thoại, địa chỉ, shipping label, note hoặc URL vào database AI, log, prompt và Telegram.
- Bot chỉ gửi/nhận tại `chat_id` đã cấu hình; 1B bổ sung allowlist `user_id`.
- Secret chỉ nằm trong secret store hoặc biến môi trường, không commit vào Git.
- Mỗi truy vấn có timeout và giới hạn khoảng ngày.
- Không cho model truy cập công cụ SQL tự do.

## 7. Tiêu chí nghiệm thu 1A

- KPI khớp 100% với đối chiếu thủ công trong 7 ngày liên tiếp.
- Chạy tự động thêm 7 ngày không bỏ sót hoặc gửi trùng.
- Báo cáo luôn ghi kỳ dữ liệu, múi giờ và tình trạng nguồn.
- Reboot Windows/WSL/Docker không làm mất job hoặc gửi trùng.
- Khôi phục được database AI từ backup.
- Lỗi DB nguồn, Telegram và Claude đều retry/cảnh báo đúng.
- Không có PII trong snapshot, prompt, log và Telegram.
- Mọi con số AI nhắc đến đều tồn tại trong JSON metric đầu vào.

## 8. Ngoài phạm vi 1A

- Hỏi đáp tự do qua Telegram (thực hiện ở 1B).
- Kết nối hệ thống bán hàng `feline`.
- Tự động cảnh báo theo ngưỡng chưa được nghiệm thu.
- Tự động cập nhật trạng thái đơn hoặc giao việc cho nhân sự.

