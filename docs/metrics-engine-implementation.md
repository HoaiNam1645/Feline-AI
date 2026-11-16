# Metrics Engine - Bản triển khai 0.1

**Ngày hoàn thành:** 30/10/2026  
**Nguồn:** các view chỉ đọc trong `feline_ai_source`  
**Múi giờ nghiệp vụ:** `Asia/Ho_Chi_Minh`

## Luồng dữ liệu

```text
MySQL view không PII
  -> SourceMysqlService (TLS + CA verification)
  -> WorkshopMetricsService
  -> JSON metric cố định
  -> MetricSnapshot trong PostgreSQL
  -> Report Engine / AI Agent ở bước sau
```

AI không được truy cập MySQL hoặc tự viết SQL. AI chỉ nhận snapshot JSON đã được Metrics Engine kiểm tra và lưu lại.

## Endpoint nội bộ

- `GET /metrics/source/health`: kiểm tra kết nối, MySQL version, timezone và TLS cipher.
- `GET /metrics/workshop/daily/:date`: tính KPI cho ngày `YYYY-MM-DD` theo giờ Việt Nam.

API Docker chỉ bind vào `127.0.0.1`, chưa mở ra mạng ngoài.

## Metric đã triển khai

- Đơn mới, item, quantity.
- Khối lượng theo embroidery/print, loại đơn và mức ưu tiên.
- So sánh hôm trước và cùng thứ tuần trước.
- Số đơn/item hoàn tất các stage `staff`, `qc`, `packing`, `shipout`.
- Backlog hiện tại theo trạng thái, tuổi đơn và thanh toán.
- Sự kiện hủy/refund có thể xác nhận từ `timeline`.
- Remake theo số case, quantity, trạng thái và chi phí.
- Các trường chi phí thô, gắn nhãn `provisionalCosts`, chưa công bố là tổng fulfillment.
- Chất lượng dữ liệu: tracking, `complete_time`, soft-delete/test order, workflow thiếu thời gian và bản ghi mồ côi.

## Kết quả đối chiếu ngày 29/10/2026

| Chỉ số | Kết quả |
|---|---:|
| Đơn mới | 99 |
| Item / quantity | 112 / 112 |
| Embroidery | 112 |
| Shipout hoàn tất | 158 đơn / 160 item |
| So với hôm trước | -5,7% |
| So với cùng thứ tuần trước | -26,1% |

Các số liệu khớp truy vấn khảo sát độc lập trước khi viết Metrics Engine.

Backlog là snapshot tại thời điểm chạy nên sẽ thay đổi theo hoạt động xưởng. Lần chạy kiểm thử ghi nhận 180 đơn, trong đó 57 đơn từ 72 giờ trở lên.

## Lưu snapshot

Worker đã chạy thành công state machine:

```text
EXTRACTING -> VALIDATING -> SNAPSHOT_SAVED
```

Snapshot ngày 29/10/2026 lưu Metric Spec `0.1`, 99 đơn mới và 158 đơn shipout. Khóa duy nhất theo ngày báo cáo ngăn tạo nhiều snapshot độc lập cho cùng ngày; chạy lại sẽ cập nhật cùng bản ghi.

## Phát hiện chất lượng dữ liệu

- `tracking` chưa có bản ghi.
- `orders.complete_time` chưa có dữ liệu.
- Có 9 production không ghép được với `order_items`; cần xác minh đây là dữ liệu cũ/đã xóa hay lỗi toàn vẹn.
- Không có workflow `completed = 1` nhưng thiếu `completed_at` trong lần kiểm thử.

