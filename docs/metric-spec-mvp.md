# Metric Spec MVP - Báo cáo vận hành xưởng

**Phiên bản:** 0.1-draft  
**Nguồn:** `shop-test` / MySQL `lemiex-test`  
**Phạm vi:** Giai đoạn 0-1A, chỉ đọc (R0)  
**Múi giờ báo cáo:** `Asia/Ho_Chi_Minh`

## 1. Quy ước chung

- MySQL đang lưu và trả thời gian theo UTC.
- Ngày báo cáo `D` theo giờ Việt Nam dùng khoảng nửa mở `[D-1 17:00:00, D 17:00:00)` UTC.
- Mặc định loại bản ghi `orders.deleted_at IS NOT NULL`, `order_items.deleted_at IS NOT NULL` và đơn có `fulfill_status = 'test_order'`.
- Không đọc, lưu hoặc gửi các cột PII: tên, điện thoại, địa chỉ, shipping label, ghi chú và URL có thể chứa dữ liệu khách hàng.
- Mọi KPI tiền tệ và SLA chỉ được đưa vào báo cáo chính thức sau khi chủ doanh nghiệp xác nhận công thức.

## 2. Nguồn dữ liệu được phép

| Bảng | Mục đích | Cột chính được dùng |
|---|---|---|
| `orders` | Đơn, trạng thái, thời gian, chi phí | `id`, `store_id`, các trạng thái, loại đơn, phương thức giao, ưu tiên, chi phí, `process_time`, timestamps |
| `order_items` | Khối lượng sản phẩm | `id`, `order_id`, `method`, `quantity`, timestamps |
| `productions` | Tình trạng cấp phát/sản xuất | `order_item_id`, `quantity`, `status`, timestamps |
| `order_item_workflows` | Tiến độ staff/QC/packing/shipout | `order_item_id`, `stage`, `completed`, `completed_at` |
| `order_item_remakes` | Lỗi và làm lại | ID liên kết, `quantity`, nguồn lỗi, trạng thái, chi phí, timestamps |
| `timeline` | Sự kiện nghiệp vụ | `object`, `object_id`, `action`, timestamps; không dùng `note` |
| `tracking` | Theo dõi vận chuyển | trạng thái, dịch vụ, phương thức, timestamps; hiện chưa có dữ liệu |
| `stores` | Phân nhóm cửa hàng | Chỉ ID/mã định danh không chứa PII |

## 3. Công thức KPI đã đủ căn cứ

### M01 - Đơn mới

- Công thức: đếm `orders.id` có `created_at` trong kỳ báo cáo sau bộ lọc chung.
- Đơn hủy trong ngày vẫn thuộc số đơn mới; hủy là một KPI riêng.
- Trạng thái: **dùng được**, chờ chủ doanh nghiệp xác nhận lần cuối mốc `created_at`.

### M02 - Item và quantity tiếp nhận

- Item: đếm `order_items.id` thuộc các đơn M01.
- Quantity: tổng `order_items.quantity` thuộc các đơn M01.
- Phân nhóm theo `order_items.method` (`embroidery`, `print`) và `orders.order_type`.
- Trạng thái: **dùng được**. Đề xuất dùng `quantity` làm chỉ số tải chính, item và đơn là chỉ số phụ.

### M03 - Hoàn tất từng công đoạn

- Một đơn hoàn tất stage khi tất cả dòng workflow của stage đó có `completed = 1`.
- Thời điểm hoàn tất stage của đơn là `MAX(order_item_workflows.completed_at)`.
- Đếm đơn có thời điểm hoàn tất stage nằm trong kỳ báo cáo.
- Các stage: `staff`, `qc`, `packing`, `shipout`.
- Trạng thái: **dùng được**.

### M04 - Đơn hoàn tất xưởng trong ngày

- Dùng M03 với stage `shipout`.
- Không dùng `orders.complete_time`: khảo sát ngày 30/10/2026 cho thấy toàn bộ 15.844 bản ghi đang để `NULL`.
- Không đếm trực tiếp sự kiện `timeline.action = 'shipout_complete'` vì một đơn có thể có nhiều item/position và sinh nhiều sự kiện.
- Trạng thái: **dùng được**.

### M05 - Backlog hiện tại

- Đếm đơn tại thời điểm snapshot, sau bộ lọc chung, có trạng thái không thuộc:
  `shipped`, `cancelled`, `cancelled_refund_shipping`, `closed`, `test_order`.
- Phân nhóm theo `fulfill_status`, `payment_status` và tuổi đơn: `<24h`, `24-48h`, `48-72h`, `>=72h`.
- `on_hold` và `pending_stock` vẫn hiển thị nhưng tách riêng để không che khuất nguyên nhân tồn.
- Trạng thái: **dùng được** cho backlog; chưa được gọi là “trễ SLA”.

### M06 - Production hiện tại

- Phân nhóm `productions.status`: `pending`, `mapped`, `completed`, `canceled`, `pickup`.
- Hiển thị cả số production và tổng quantity.
- Đây là snapshot hiện tại, không phải lịch sử chuyển trạng thái.
- Trạng thái: **dùng được**.

### M07 - Remake/lỗi

- Số case: đếm `order_item_remakes.id` theo `created_at` trong kỳ.
- Khối lượng: tổng `quantity`; chi phí: tổng `price`.
- Phân nhóm theo `status`, `error_source`, `garment_source`; không gửi tên người chịu trách nhiệm.
- Trạng thái: **dùng thử**; cần chốt trạng thái nào là hoàn tất và ý nghĩa `unit_price`/`price`.

## 4. KPI còn chờ quyết định nghiệp vụ

### M08 - Đơn trễ SLA

Chưa tính chính thức. Cần chốt:

- Mốc bắt đầu: `created_at`, thời điểm paid, confirm hay bắt đầu sản xuất.
- SLA chuẩn theo `shipping_method`, `fulfillment_priority` và ngày nghỉ.
- Cách xử lý `on_hold`, `pending_stock` và đơn chưa thanh toán.

Trong thời gian chờ, báo cáo chỉ hiển thị **tuổi backlog**, không gắn nhãn trễ.

### M09 - Hủy/refund trong ngày

- Hủy có thể lấy theo sự kiện `timeline` (`cancelled order`, `closed order`) nhưng cần xác minh mọi luồng đều ghi sự kiện nhất quán.
- `payment_status` chỉ cho trạng thái hiện tại, không cho biết chính xác ngày refund.
- `refund_fee` là giá trị hiện tại của đơn, không mặc định coi `updated_at` là thời điểm refund.

### M10 - Chi phí fulfillment

Các trường khả dụng: `total_cost`, `paid_cost`, `print_cost`, `embroidery_fee`, `no_design_fee`, `extra_fee`, `refund_fee`, `priority_fee`, `shipping_cost`.

Chưa cộng thành một “tổng chi phí fulfillment” mới cho đến khi xác nhận:

- Đơn vị tiền tệ.
- `total_cost` đã bao gồm những thành phần nào.
- Trường nào là khoản phải thu, đã thu, chi phí hoặc hoàn trả.
- Giá trị `NULL` được hiểu là thiếu dữ liệu hay bằng 0.

## 5. Kiểm tra chất lượng dữ liệu

Mỗi lần chạy phải lưu và đánh giá:

- `MAX(updated_at)` và số bản ghi của từng bảng nguồn.
- Tỷ lệ đơn/item bị loại do soft-delete hoặc `test_order`.
- Số item không có production/workflow.
- Số workflow thiếu stage hoặc thiếu `completed_at` khi `completed = 1`.
- Số quantity bằng 0/NULL và chi phí NULL.
- Tình trạng bảng `tracking`; ngày 30/10/2026 bảng này có 0 bản ghi.

Nếu metric bắt buộc không tính được, báo cáo vẫn gửi đúng giờ nhưng ghi rõ phần thiếu; không dùng số gần nhất thay thế mà không gắn nhãn.

## 6. Phát hiện kỹ thuật cần xử lý

- `orders.process_time` được service hiện tại tính bằng **giờ** khi chuyển sang `shipped`.
- Migration đổi kiểu cột lại mô tả là “số ngày”; tài liệu và code đang mâu thuẫn. Metric Engine phải coi giá trị là giờ theo code đang chạy và có test xác nhận.
- `orders.complete_time` chưa được gán trong luồng hiện tại, không được dùng cho KPI hoàn tất.
- Báo cáo lịch sử backlog cần snapshot riêng trong database AI; database nguồn chỉ phản ánh trạng thái hiện tại.

## 7. Baseline khảo sát ngày 30/10/2026

- `orders`: 15.844; `order_items`: 17.848; `productions`: 17.844.
- `order_item_workflows`: 77.992; `order_item_remakes`: 1; `tracking`: 0.
- Backlog tại thời điểm khảo sát: 171 đơn.
- Các số này chỉ là baseline kỹ thuật, không phải báo cáo nghiệm thu.

