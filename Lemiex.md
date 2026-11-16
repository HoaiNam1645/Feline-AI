# Lemiex AI - Business Knowledge và Data Dictionary

> Phiên bản phân tích: 2026-11-03  
> Phạm vi: hệ thống Lemiex tại source local và schema production (chỉ đọc).  
> Mục tiêu: làm nguồn nghiệp vụ cho Lemiex AI; không phải đặc tả thay đổi code.  
> Quy ước mức độ tin cậy:
>
> - **[Đã xác minh]**: có căn cứ trực tiếp từ model, migration, enum, service hoặc schema production.
> - **[Cần xác nhận nghiệp vụ]**: code cho phép nhiều cách hiểu hoặc chưa có định nghĩa quản trị thống nhất.
> - **[Chưa đủ dữ liệu]**: hệ thống hiện không lưu đủ dữ liệu để kết luận.

## 0. Phạm vi an toàn

- **[Đã xác minh]** Tài liệu không chứa mật khẩu, API key, connection string hoặc dữ liệu khách hàng.
- **[Đã xác minh]** `stores.api_key`, địa chỉ nhận hàng, số điện thoại, nội dung file thiết kế, URL label và các thông tin định danh nhân sự là dữ liệu nhạy cảm; không đưa nguyên giá trị vào ngữ cảnh AI thông thường.
- **[Đã xác minh]** Schema production chỉ được đọc để đối chiếu kiểu cột và enum. Không có thao tác ghi database trong quá trình lập tài liệu.
- **[Cần xác nhận nghiệp vụ]** Trước khi triển khai Lemiex AI, đội Lemiex cần chốt ma trận quyền theo role và phạm vi seller/store. AI không được mặc định rằng Manager có quyền đọc mọi dữ liệu tài chính hoặc PII.

## 1. Tổng quan hệ thống

### 1.1 Lemiex giải quyết nghiệp vụ gì?

**[Đã xác minh]** Lemiex là hệ thống quản lý fulfillment và vận hành xưởng cho đơn hàng cá nhân hóa, chủ yếu gồm thêu và in. Hệ thống tiếp nhận đơn từ seller/store, lưu sản phẩm và file thiết kế, tính phí, thu tiền từ ví seller, quản lý tồn kho/phôi, theo dõi sản xuất theo từng item và từng mặt, QC, đóng gói, shipout, tracking, hỗ trợ và làm lại sản phẩm lỗi.

Căn cứ:

- `manage-lemiex/app/Models/Order.php`: thông tin đơn, phí, vận chuyển, người nhận và trạng thái.
- `manage-lemiex/app/Models/OrderItem.php`: item, variant, quantity, method và file/mockup.
- `manage-lemiex/app/Services/OrderItemService.php::changeWorkflowStatus()`: luồng `staff -> qc -> packing -> shipout`.
- `manage-lemiex/app/Services/OrderFulfillStatusService.php::changeFulfillStatus()`: chuyển trạng thái đơn, mapping tồn kho, hoàn tiền và timeline.
- `manage-lemiex/app/Jobs/PayOrderJob.php`: thu tiền và ghi `paid_cost`.

### 1.2 Bộ phận/role sử dụng

| Nhóm | Vai trò nghiệp vụ chính | Căn cứ |
|---|---|---|
| Admin | Quản trị toàn hệ thống, trạng thái, giá, hoàn tiền | `app/Enums/UserRole.php`, `OrderFulfillStatusService` |
| Seller / SellerPartner | Tạo đơn, trả phí fulfillment, xem đơn thuộc phạm vi được cấp | `UserRole::sellerRoleIds()`, `DashboardController` |
| Staff | Vận hành sản xuất/thêu, đánh dấu công đoạn `staff` | `OrderItemController`, `OrderItemService` |
| QC | Kiểm tra chất lượng, hoàn tất `qc`, báo remake | `OrderItemService`, `OrderItemRemakeController` |
| Packing | Đóng gói, hoàn tất `packing` | `OrderItemService` |
| Shipout | Xuất hàng, hoàn tất `shipout` | `OrderItemService` |
| Support | Xử lý ticket, đơn trả về hỗ trợ | `Support`, `OrderFulfillStatus::RETURN_TO_SUPPORT` |
| Designer | Xử lý thiết kế/no-design | `Design`, `OrderItem.is_no_design` |
| Supplier | Nhóm nghiệp vụ nhà cung cấp; có thể là nguồn lỗi remake | `UserRole`, `OrderItemRemake.error_source=supplier` |
| Finance / Accountant | Giao dịch, đối soát và báo cáo tiền | `Transaction`, quyền payroll/report |
| HR | Nhân sự, chấm công, payroll; một số quyền quản trị trạng thái | `UserRole`, `PayrollController`, `OrderFulfillStatusService` |

### 1.3 Quy trình đơn hàng điển hình

1. **Tiếp nhận đơn**: tạo `orders`, sau đó tạo `order_items`; trạng thái xử lý kỹ thuật bắt đầu bằng `processing_status=creating`.
2. **Tách item**: với luồng áo/thêu thông thường, quantity lớn hơn 1 được tách thành nhiều row `order_items`, mỗi row có `quantity=1`. Tumbler hiện có luồng không tách quantity.
3. **Xử lý file và tính giá**: tạo `order_item_metas`, convert file, đọc stitch/color nếu có, tính `print_cost`, shipping và các phụ phí; cập nhật `total_cost`.
4. **Thanh toán**: khi pay thành công, hệ thống trừ ví seller, ghi transaction và đặt `paid_cost`, `payment_status=paid`.
5. **Chuẩn bị tồn kho**: tạo `productions`; trạng thái `pending` trước khi phôi được map/trừ kho, `mapped` sau khi map.
6. **Sản xuất**: workflow được theo từng `order_item_id + position + stage`. Chạm công đoạn staff có thể chuyển order sang `producing`.
7. **QC**: khi toàn bộ vị trí của toàn bộ item hoàn tất QC, order có thể thành `qc_pass`.
8. **Đóng gói**: khi toàn bộ item/mặt hoàn tất packing, order có thể thành `packed`.
9. **Shipout**: khi toàn bộ item/mặt hoàn tất shipout, order thành `shipped`; hoặc người có quyền đổi trực tiếp sang `shipped`, hệ thống tự hoàn tất workflow trước đó.
10. **Tracking**: `tracking` theo dõi trạng thái carrier sau khi có mã vận đơn.
11. **Ngoại lệ**: đơn có thể `on_hold`, `return_to_support`, thiếu stock, cancel, refund/closed hoặc phát sinh nhiều lần remake.

Căn cứ chính: `OrderService::createOrderItems()`, `OrderProcessingService::processConvert()`, `PayOrderJob`, `OrderItemService::changeWorkflowStatus()`, `OrderFulfillStatusService::changeFulfillStatus()`.

### 1.4 Từ điển khái niệm cốt lõi

| Khái niệm | Định nghĩa đúng trong Lemiex | Điểm dễ hiểu sai |
|---|---|---|
| Order | Header của một yêu cầu fulfillment/gói hàng; chứa seller, người nhận, phí và trạng thái tổng | Không đồng nghĩa một sản phẩm hay một áo |
| Order Item | Một dòng sản phẩm vận hành. Với đa số đơn áo, mỗi row thường là một đơn vị vật lý do hệ thống tách quantity | Không luôn bằng quantity; Tumbler có thể giữ quantity > 1 |
| Quantity | Số lượng vật lý trong một item row; tổng sản phẩm là `SUM(order_items.quantity)` | Không dùng `COUNT(order_items)` nếu còn luồng không tách quantity |
| Production | Bản ghi nhu cầu/mapping phôi kho cho item | `completed` của production không phải workflow QC/packing đã xong |
| Workflow | Tiến độ theo từng item, từng vị trí và từng stage | Một item nhiều mặt sinh nhiều workflow row cho cùng stage |
| Tracking | Trạng thái vận chuyển của carrier | `delivered` khác `orders.fulfill_status=shipped` |
| Shipout | Công đoạn xưởng giao kiện ra ngoài (`workflow.stage=shipout`) và thường dẫn đến `orders.fulfill_status=shipped` | Không đồng nghĩa carrier đã giao thành công |
| Backlog | Khái niệm báo cáo đề xuất: công việc hợp lệ chưa ở trạng thái kết thúc tại thời điểm snapshot | DB không có cột `backlog`; phải chốt tập trạng thái |
| Remake | Một sự cố/lần xác nhận làm lại của một item; một item có thể có nhiều remake | Không được đếm distinct item nếu câu hỏi là số lần làm lại |
| Ref ID | Mã tham chiếu bên seller/store | Khác `orders.id`, là mã nội bộ Lemiex |
| Item status | Boolean `order_items.status`; hiện được dùng như dấu item đã map/hoàn tất stage staff | Không phải trạng thái đầy đủ của item; xem workflow mới biết từng công đoạn |

## 2. Danh sách bảng dữ liệu

| Table | Mục đích | Primary key | Quan hệ | Trường quan trọng | Điều kiện loại trừ | AI được phép đọc |
|---|---|---|---|---|---|---|
| `orders` | Header đơn, giá, trạng thái, vận chuyển, người nhận | `id` | seller, store, items, tracking, transactions | status, costs, created/complete time | `deleted_at IS NOT NULL`; tùy metric loại test/cancel/final | Có điều kiện; phải ẩn PII và giới hạn seller |
| `order_items` | Sản phẩm/đơn vị vận hành trong order | `id` | order, variant, metas, productions, workflows, remakes | quantity, price, method, status | item hoặc order bị soft-delete | Có điều kiện; không xuất URL file tùy tiện |
| `order_item_metas` | File theo mặt, stitch, màu chỉ, loại thêu và phí theo mặt | `id` | order item | meta_key/value, switch, color codes, extra_fee | meta kỹ thuật không liên quan metric; item bị loại | Có điều kiện; URL file có thể nhạy cảm |
| `productions` | Nhu cầu phôi và trạng thái mapping kho | `id` | order item, variant | quantity, status | order/item deleted; production canceled tùy metric | Có cho metric tổng hợp |
| `order_item_workflows` | Tiến độ từng item + mặt + công đoạn | `id` | order item, completed user | position, stage, completed, completed_at | item/order deleted; `completed=0` với metric hoàn thành | Có cho metric; tên nhân viên theo quyền |
| `order_item_remakes` | Mỗi lần báo lỗi/làm lại | `id` | order, item, operator, reporter | quantity, source, reason, status, price | Không tự loại record cũ; lọc theo câu hỏi | Có điều kiện; lý do/tên người chịu trách nhiệm nhạy cảm nội bộ |
| `tracking` | Trạng thái carrier của order | `id` | order | tracking_id, status, update_time | order deleted; tracking rỗng | Chỉ tổng hợp; mã tracking là dữ liệu nhạy cảm |
| `timeline` | Nhật ký sự kiện nhiều loại object | `id` | liên kết logic bằng object/object_id | action, note, owner_id, created_at | object gốc deleted tùy báo cáo | Có điều kiện; note có thể chứa tên hoặc dữ liệu vận hành |
| `stores` | Store thuộc seller, API integration | `id` | user, orders | name, user_id, api_key | không có soft delete trong model | Chỉ `id/name` theo phạm vi; tuyệt đối không đọc `api_key` |
| `transactions` | Thu tiền, nạp tiền, hoàn tiền, surcharge | `id` | seller, order | amount, type, status, remaining balance | deleted/rejected; pending tùy metric | Chỉ tài chính theo quyền; không cho role vận hành thường |
| `product_variants` | SKU/style/color/size, stock và giá nhà cung cấp | `id`, business key `variant_id` | product, productions | variant_id, stock, supplier_price, active | deleted/inactive tùy metric | Stock cho nội bộ; supplier price bị giới hạn |
| `products` | Sản phẩm/style và khả năng thêu/in | `id` | variants, decoration methods | name, style, status | soft-deleted/inactive | Có theo quyền catalog |
| `supports` | Ticket hỗ trợ theo order/item | `id` | user, order, item | type, subject, status | soft-deleted | Có điều kiện; nội dung ticket nhạy cảm |
| `users`, `user_profiles` | Tài khoản, role, ví và hồ sơ | `id` | seller/employee/transactions | role, username, wallet | deleted/disabled | Chỉ tối thiểu theo role; không đưa PII/ví cho user không có quyền |

Nguồn: model trong `manage-lemiex/app/Models/`; schema production; migrations trong `manage-lemiex/database/migrations/`.

## 3. Data dictionary

### 3.1 `orders`

| Field | Kiểu production | Ý nghĩa nghiệp vụ và thời điểm cập nhật | Giá trị | Null | Nhạy cảm |
|---|---|---|---|---|---|
| `id` | bigint unsigned | Mã nội bộ/khoá chính, sinh khi tạo order | số nguyên | Không | Thấp |
| `ref_id` | varchar | Mã tham chiếu seller; dùng đối soát/import | tự do, unique nếu có | Có | Trung bình |
| `seller_id` | bigint | Seller sở hữu/chi trả order | FK users | Có | Trung bình |
| `seller_ref` | varchar | Tham chiếu phụ từ seller | tự do | Có | Trung bình |
| `store_id` | bigint | Store nguồn của đơn | FK stores | Có | Trung bình |
| `shipping_label` | text | URL/nội dung label seller cung cấp hoặc hệ thống mua | URL/text | Có | Cao |
| `shipping_flow` | varchar | Sự thật về bên chịu luồng ship tại lúc tạo | `seller_provided`, `system_ship` | Có với dữ liệu bất thường | Trung bình |
| `shipping_service` | enum | Carrier | USPS/FedEx/UPS | Có | Thấp |
| `shipping_method` | enum | Gói dịch vụ vận chuyển | standard/express/priority | Có | Thấp |
| `shipping_json` | text | Payload/rate/response kỹ thuật của ship provider | JSON/text | Có | Cao |
| `shipping_cost` | decimal | Phí vận chuyển tính cho order | USD | Có | Tài chính |
| `tracking_id` | varchar | Mã vận đơn gắn trên order | text | Có | Cao |
| `tracking_link` | varchar | Link carrier | URL | Có | Cao |
| `fulfill_status` | enum | Trạng thái vận hành tổng của order | xem mục 4 | Không | Thấp |
| `processing_status` | enum | Trạng thái pipeline tạo file/giá/QR | xem mục 4 | Không | Nội bộ |
| `payment_status` | enum | Tình trạng thu/hoàn phí fulfillment | xem mục 4 | Không | Tài chính |
| `total_cost` | decimal | Tổng phí fulfillment hiện được tính cho seller | USD | Có | Tài chính |
| `paid_cost` | decimal | Số tiền được chốt/đã thu tại lần pay gần nhất | USD | Có | Tài chính |
| `print_cost` | decimal | Thành phần giá sản phẩm/base + mặt trang trí theo logic pricing | USD | Có | Tài chính |
| `extra_fee` | decimal | Phụ phí, chủ yếu stitch/khổ theo xử lý file | USD | Không | Tài chính |
| `refund_fee` | decimal | Khoản giảm trừ trong công thức giá; không tự chứng minh tiền đã hoàn | USD | Không | Tài chính |
| `embroidery_fee` | decimal | Phụ phí loại thêu | USD | Không | Tài chính |
| `no_design_fee` | decimal | Phí team xử lý item không có design | USD | Không | Tài chính |
| `priority_fee` | decimal | Phí ưu tiên fulfillment | USD | Không | Tài chính |
| `convert_label`, `override_label` | text | Label đã convert/ghi đè | URL/text | Có | Cao |
| `note` | text | Ghi chú cấp order | tự do | Có | Cao |
| `order_stt` | varchar | Số/thứ tự hiển thị nghiệp vụ | text | Có | Thấp |
| `order_type` | enum | Nhóm đơn/sản phẩm cấp order | Shirt/Poster/Tote/Tumbler | Có | Thấp |
| `process_time` | int unsigned | Số giờ từ created tới lúc tính khi đổi sang shipped bằng status service | giờ | Có | Thấp |
| `complete_time` | timestamp | Dự kiến là thời điểm hoàn tất; code hiện không đảm bảo cập nhật mọi luồng | datetime | Có | Thấp |
| `scan_early` | boolean | Cờ scan sớm | 0/1 | Không | Nội bộ |
| `merged_url`, `post_json` | text | Output ghép file và payload gốc/backup | URL/JSON | Có | Cao |
| `first_name`...`country` | varchar | Thông tin người nhận | text | Có | **Rất cao** |
| `fulfillment_priority` | varchar | Mức ưu tiên thực tế của đơn | production đang dùng `normal`/`priority` | Không | Thấp |
| `created_at`, `updated_at`, `deleted_at` | timestamp | Tạo, sửa, xóa mềm | datetime | Có | Thấp |

**Căn cứ:** `Order` model, schema production, `OrderProcessingService`, `PayOrderJob`, `OrderFulfillStatusService::calculateProcessTime()`.

### 3.2 `order_items`

| Field | Kiểu | Ý nghĩa nghiệp vụ | Giá trị | Null | Nhạy cảm |
|---|---|---|---|---|---|
| `id` | bigint | Khoá item | số | Không | Thấp |
| `order_id` | bigint | Order chứa item | FK | Có do schema cũ | Trung bình |
| `variant_id` | varchar | Business key của variant/SKU | text | Có | Trung bình |
| `method` | enum | Kênh trang trí riêng của item | embroidery/print | Không | Thấp |
| `external_item_id` | varchar | ID item phía seller; khi split có hậu tố `-1`, `-2` | text | Có | Trung bình |
| `product_name` | text | Tên sản phẩm snapshot lúc tạo | text | Có | Thấp |
| `quantity` | decimal | Số đơn vị vật lý trong row | thường 1 với áo; có thể >1 ở luồng khác | Có | Thấp |
| `price` | decimal | Giá item do engine pricing gán | USD | Có | Tài chính |
| `status` | boolean | Item đã xử lý/map ở stage staff | 0/1 | Không | Nội bộ |
| `mockup`, `mockup_back`, `pdf` | text | File/ảnh thiết kế | URL/text | Có | Cao |
| `is_no_design` | boolean | Seller yêu cầu team làm thiết kế | 0/1 | Không | Thấp |
| `sides` | int | Số mặt dự kiến | số | Có | Thấp |
| `id_style` | varchar | Mã style phụ | text | Có | Thấp |
| `note` | text | Ghi chú riêng item | tự do | Có | Cao |
| timestamps, `deleted_at` | timestamp | Audit và xóa mềm | datetime | Có | Thấp |

**Căn cứ:** `OrderService::createOrderItems()`, migration `add_external_item_id`, model `OrderItem`.

### 3.3 `productions`

| Field | Kiểu | Ý nghĩa | Giá trị | Null | Nhạy cảm |
|---|---|---|---|---|---|
| `id` | bigint | Khoá production | số | Không | Thấp |
| `order_item_id` | bigint | Item cần phôi | FK | Không | Trung bình |
| `product_variant_id` | varchar | Variant bị giữ/trừ kho | business key | Không | Trung bình |
| `quantity` | decimal | Số phôi cần dùng | số | Không | Thấp |
| `status` | enum | Trạng thái mapping kho | pending/mapped/completed/canceled/pickup | Không | Nội bộ |
| `note` | text | Lý do/nguồn tạo | text | Có | Nội bộ |
| timestamps | timestamp | Tạo/cập nhật production | datetime | Có | Thấp |

**Lưu ý:** **[Đã xác minh]** workflow sản xuất thực tế nằm ở `order_item_workflows`; `productions.status=mapped` chủ yếu phản ánh kho/phôi.

### 3.4 `order_item_workflows`

| Field | Kiểu | Ý nghĩa | Giá trị | Null | Nhạy cảm |
|---|---|---|---|---|---|
| `id` | bigint | Khoá workflow row | số | Không | Thấp |
| `order_item_id` | bigint | Item được xử lý | FK | Không | Trung bình |
| `position` | enum | Mặt/vị trí trên item | front/back/sleeve_left/sleeve_right/neck | Không | Thấp |
| `stage` | enum | Công đoạn | staff/qc/packing/shipout | Không | Thấp |
| `completed` | boolean | Công đoạn của đúng item + position đã xong | 0/1 | Không | Thấp |
| `completed_by` | bigint | User hoàn tất/được auto gán | FK users | Có | **Nhân sự** |
| `completed_at` | timestamp | Thời điểm hoàn tất; nguồn đúng cho metric theo công đoạn | datetime | Có | Nội bộ |
| timestamps | timestamp | Tạo/cập nhật row | datetime | Có | Thấp |

**[Đã xác minh]** Unique key là `(order_item_id, position, stage)`.  
**[Cần xác nhận nghiệp vụ]** Service có `wrap` trong `TRACKABLE_POSITIONS`, nhưng enum production của cột `position` chưa có `wrap`; workflow cho item in wrap có nguy cơ lỗi ghi DB.

### 3.5 `order_item_remakes`

| Field | Kiểu | Ý nghĩa | Giá trị | Null | Nhạy cảm |
|---|---|---|---|---|---|
| `id` | bigint | ID mỗi lần remake | số | Không | Thấp |
| `order_id`, `order_item_id` | bigint | Order/item gốc | FK | Không | Trung bình |
| `item_number` | int | Số thứ tự item trong order tại lúc tạo remake | số | Không | Thấp |
| `variant_id` | varchar | Variant phôi thực tế dùng cho remake | text | Có | Trung bình |
| `track_url` | text | URL track order | URL | Không | Cao |
| `mockup_url` | text | Mockup snapshot | URL | Có | Cao |
| `quantity` | decimal | Số lượng làm lại trong lần này | số | Không | Thấp |
| `style`, `color`, `size` | varchar | Snapshot phôi remake | text | Có | Thấp |
| `operator_id` | bigint | Người vận hành bị quy trách nhiệm khi source=operator | FK | Có | **Nhân sự** |
| `error_source` | varchar | Nguồn lỗi | operator/vn_design/supplier | Không | **Nhân sự** |
| `responsible_name` | varchar | Tên team/xưởng chịu trách nhiệm ngoài operator | text | Có | **Nhân sự** |
| `garment_source` | varchar | Dùng phôi đúng item hay một loại áo sai khác | item/other | Không | Nội bộ |
| `reported_by` | bigint | Người báo lỗi | FK | Không | **Nhân sự** |
| `position` | varchar | Mặt lỗi; null có thể hiểu toàn item | position/null | Có | Thấp |
| `reason` | text | Lý do lỗi | tự do | Không | **Nhạy cảm nội bộ** |
| `status` | varchar | Vòng đời remake | pending/producing/completed/reset_failed | Không | Thấp |
| `unit_price`, `price` | decimal | Giá snapshot và tổng giá remake | USD | Không | Tài chính |
| `workflow_snapshot` | JSON | Ai đã làm gì trước lúc reset workflow | JSON | Có | **Nhân sự** |
| timestamps | timestamp | Tạo/cập nhật remake | datetime | Có | Thấp |

**[Đã xác minh]** Một item có thể có nhiều remake; không có unique constraint trên `order_item_id`.

### 3.6 `tracking`, `timeline`, `stores`

| Table.Field | Kiểu | Ý nghĩa | Null | Nhạy cảm |
|---|---|---|---|---|
| `tracking.tracking_id` | varchar | Mã carrier | Có | Cao |
| `tracking.order_id` | bigint | Order tương ứng | Có | Trung bình |
| `tracking.status` | enum | Trạng thái carrier | Không | Thấp |
| `tracking.service`, `method` | enum | Carrier/gói ship | Không | Thấp |
| `tracking.total_day` | int | Số ngày vận chuyển theo integration | Có | Thấp |
| `tracking.ssk` | text | Dữ liệu kỹ thuật provider | Có | Cao |
| `tracking.update_time` | timestamp | Mốc provider cập nhật | Có | Thấp |
| `timeline.object`, `object_id` | enum/bigint | Loại object và ID logic | Không | Trung bình |
| `timeline.owner_id` | int | Chủ sở hữu/seller theo event | Có | Trung bình |
| `timeline.action` | varchar | Tên sự kiện không chuẩn hóa hoàn toàn | Không | Nội bộ |
| `timeline.note` | text | Mô tả tự do | Có | Cao |
| `stores.user_id` | bigint | Seller sở hữu store | Không | Trung bình |
| `stores.name` | varchar | Tên store | Không | Trung bình |
| `stores.api_key` | varchar | Khoá tích hợp | Không | **Tuyệt mật - AI không đọc** |

## 4. Trạng thái nghiệp vụ

### 4.1 Fulfill status của Order

| DB value | Tên Việt | Ý nghĩa | Trạng thái trước điển hình | Trạng thái sau điển hình | Hoàn tất |
|---|---|---|---|---|---|
| `new_order` | Đơn mới | Vừa tiếp nhận, chưa vào sản xuất | - | confirm/pending_stock/producing/on_hold/cancelled | Không |
| `confirm` | Đã xác nhận | Đã xác nhận/đủ điều kiện bước tiếp | new_order/on_hold | producing/pending_stock/cancelled | Không |
| `pending_stock` | Chờ tồn kho | Chưa đủ phôi để phân bổ | new_order/confirm/in_stock | producing/on_hold/cancelled | Không |
| `in_stock` | Đủ tồn kho | Stock allocation đặt tự động | pending_stock/new_order | producing | Không |
| `producing` | Đang sản xuất | Ít nhất workflow staff được làm hoặc đổi tay | confirm/in_stock/new_order/on_hold | qc_pass/on_hold/return_to_support/cancelled | Không |
| `qc_pass` | Đã qua QC | Mọi item/mặt hoàn tất QC hoặc auto-complete | producing | packed/shipped | Không |
| `packed` | Đã đóng gói | Mọi item/mặt hoàn tất packing | qc_pass/producing | shipped | Không |
| `shipped` | Đã shipout | Xưởng đã xuất kiện; chưa có nghĩa delivered | packed/producing/bất kỳ khi admin đổi | tracking tiếp tục | Có đối với xưởng |
| `on_hold` | Tạm giữ | Dừng xử lý chờ giải quyết | nhiều trạng thái | confirm/producing/cancelled/support | Không |
| `return_to_support` | Trả về hỗ trợ | Cần Support xử lý | nhiều trạng thái | producing/on_hold/cancelled | Không |
| `cancelled` | Đã hủy, không mặc định hoàn tiền | Dừng order và cancel production | nhiều trạng thái | có thể admin khôi phục | Có |
| `cancelled_refund_shipping` | Hủy và hoàn phí ship | Chỉ khi paid, thực hiện refund shipping | paid order | cuối | Có |
| `closed` | Đóng và hoàn toàn phần theo service | Trạng thái full refund của order paid | paid order | có thể admin mở lại và recharge | Có |
| `test_order` | Đơn test | Không tạo production chuẩn | new/test flow | cuối theo báo cáo | Có/loại báo cáo |

**[Đã xác minh]** `OrderStatus::isFinalState()` coi shipped, cancelled, cancelled_refund_shipping, closed là final.  
**[Đã xác minh]** Admin/HR có thể bypass nhiều transition, vì vậy cột “trước/sau” là luồng điển hình, không phải ràng buộc tuyệt đối.  
**[Đã xác minh]** `cancelled` không đồng nghĩa đã hoàn tiền; `closed` mới kích hoạt `refund_full` trong service hiện tại.

### 4.2 Payment và processing

| Nhóm | DB value | Tên Việt | Ý nghĩa | Hoàn tất |
|---|---|---|---|---|
| payment | `pending` | Chờ thanh toán | Chưa chốt thu đủ | Không |
| payment | `paid` | Đã thanh toán | `paid_cost` đã được chốt khi pay | Có về thu tiền |
| payment | `full_refund` | Hoàn toàn phần | Trạng thái payment khai báo | Có |
| payment | `partial_refund` | Hoàn một phần | Trạng thái payment khai báo | Có một phần |
| processing | `creating` | Đang tạo | Order/pipeline mới bắt đầu | Không |
| processing | `processing` | Đang xử lý | Đang xử lý file/giá | Không |
| processing | `pricing_completed` | Tính giá xong | Giá xong nhưng pipeline có thể chưa hoàn tất | Chưa chắc |
| processing | `completed` | Xử lý kỹ thuật xong | Pipeline tạo order/file hoàn tất | Có |
| processing | `failed` | Xử lý lỗi | Lỗi chung | Lỗi cuối |
| processing | `qr_failed` | Lỗi QR | Tạo QR lỗi | Lỗi cuối |
| processing | `pricing_failed` | Lỗi giá | Tính giá lỗi | Lỗi cuối |

### 4.3 Workflow, production, remake và tracking

| Nhóm | DB value | Tên Việt | Ý nghĩa | Hoàn tất |
|---|---|---|---|---|
| workflow stage | `staff` | Sản xuất | Công nhân làm mặt tương ứng | Khi completed=1 |
| workflow stage | `qc` | Kiểm tra chất lượng | QC mặt tương ứng | Khi completed=1 |
| workflow stage | `packing` | Đóng gói | Đóng gói mặt/item theo mô hình hiện tại | Khi completed=1 |
| workflow stage | `shipout` | Xuất hàng | Đưa item/kiện ra luồng vận chuyển | Khi completed=1 |
| workflow completed | `0` | Chưa xong | Không có completed_at hợp lệ | Không |
| workflow completed | `1` | Đã xong | Có completed_by/at; có thể được auto-complete | Có |
| production | `pending` | Chờ map phôi | Chưa trừ/giữ stock | Không |
| production | `mapped` | Đã map phôi | Stock đã được phân bổ/trừ theo service | Hoàn tất về kho |
| production | `completed` | Hoàn tất production | Enum tồn tại nhưng không phải nguồn chính của workflow | Có theo production |
| production | `canceled` | Hủy production | Dừng và có thể phục hồi stock | Có |
| production | `pickup` | Đã lấy phôi | Trạng thái phụ | Cần xác nhận |
| remake | `pending` | Chờ làm lại | Vừa xác nhận remake/reset workflow | Không |
| remake | `producing` | Đang làm lại | Staff bắt đầu hoàn tất lại workflow | Không |
| remake | `completed` | Làm lại xong | QC của toàn bộ vị trí mục tiêu hoàn tất | Có |
| remake | `reset_failed` | Reset lỗi | Tạo/khởi động remake gặp lỗi | Lỗi cuối |
| tracking | `pending` | Chờ tracking | Chưa có tiến triển | Không |
| tracking | `info_received` / `InfoReceived` | Carrier nhận thông tin | Đã tạo label/manifest | Không |
| tracking | `in_transit` | Đang vận chuyển | Carrier đang vận chuyển | Không |
| tracking | `out_for_delivery` | Đang giao | Chuẩn bị giao cuối | Không |
| tracking | `delivered` | Đã giao | Carrier xác nhận giao | Có |
| tracking | `exception` | Ngoại lệ | Carrier báo sự cố | Không |
| tracking | `not_found` | Không tìm thấy | Tracking chưa hợp lệ/không tồn tại | Không |
| tracking | `Tracking...` | Đang truy vấn | Giá trị legacy/UI | Không |

### 4.4 Priority, order type và method

| Nhóm | Giá trị production | Nghĩa |
|---|---|---|
| fulfillment priority | `normal` | Thường, phí ưu tiên bằng 0 theo cấu hình |
| fulfillment priority | `priority` | Ưu tiên, giá theo tier |
| order type | `Shirt` | Nhóm áo/thêu mặc định |
| order type | `Poster` | Poster |
| order type | `Cotton tote bag` | Túi cotton |
| order type | `Jute Tote Bag` | Túi đay |
| order type | `Tumbler` | Bình/cốc in |
| item method | `embroidery` | Thêu |
| item method | `print` | In |

**[Cần xác nhận nghiệp vụ]** `app/Enums/FulfillmentPriority.php` vẫn khai báo `normal/high/urgent`, nhưng migration và schema production đã chuyển sang `normal/priority`. Lemiex AI phải dùng schema production, đồng thời đội dev nên đồng bộ enum.

## 5. Quy tắc metric đề xuất

### 5.1 Quy tắc chung

- **[Đã xác minh]** Application timezone là `UTC`: `manage-lemiex/config/app.php`.
- **[Cần xác nhận nghiệp vụ]** Người dùng vận hành tại Việt Nam có thể mong ngày theo `Asia/Ho_Chi_Minh`. Trước khi chốt AI, phải chọn một timezone báo cáo. Không được trộn UTC và giờ Việt Nam.
- Khuyến nghị API nhận `timezone`; chuyển khoảng ngày người dùng sang UTC và dùng cửa sổ nửa mở `[start_utc, end_utc)`.
- Mặc định record hợp lệ: `orders.deleted_at IS NULL` và `order_items.deleted_at IS NULL`.
- Mặc định loại khỏi KPI vận hành bình thường: `test_order`, `cancelled`, `cancelled_refund_shipping`, `closed`; nhưng phải hiển thị riêng nếu câu hỏi hỏi hủy/hoàn.
- Khi JOIN one-to-many, order phải dùng `COUNT(DISTINCT orders.id)`, item dùng `COUNT(DISTINCT order_items.id)`, quantity phải aggregate trước hoặc không JOIN làm nhân dòng.

### 5.2 Danh mục metric

| Metric ID | Tên nghiệp vụ | Ý nghĩa | Bảng nguồn | Công thức | Trường thời gian | Lọc/loại trừ | Đơn vị |
|---|---|---|---|---|---|---|---|
| `orders.new` | Đơn mới | Order được tạo trong kỳ | orders | `COUNT(DISTINCT id)` | `orders.created_at` | valid, tùy báo cáo loại test/deleted | order |
| `items.new` | Item mới | Item row được tạo trong kỳ | order_items + orders | `COUNT(DISTINCT oi.id)` | `oi.created_at` | valid item/order | item row |
| `quantity.new` | Số sản phẩm mới | Tổng đơn vị vật lý mới | order_items + orders | `SUM(oi.quantity)` | `oi.created_at` | valid item/order | sản phẩm |
| `workflow.positions.completed` | Lượt mặt hoàn tất công đoạn | Số workflow row hoàn tất | workflows | `COUNT(*) WHERE stage=? AND completed=1` | `completed_at` | valid item/order | mặt-công đoạn |
| `workflow.items.completed` | Item hoàn tất công đoạn | Mọi position thực có của item đều completed ở stage | metas + workflows | count item thỏa `completed positions = required positions` | `MAX(completed_at)` của stage/item | valid item/order | item |
| `workflow.orders.completed` | Order hoàn tất công đoạn | Mọi item hợp lệ đều hoàn tất stage | items + workflows | count distinct order thỏa toàn bộ item | `MAX(completed_at)` của order/stage | loại final không phù hợp tùy kỳ | order |
| `shipout.items` | Item shipout trong ngày | Item hoàn tất toàn bộ vị trí shipout | workflows | như item completed với stage=shipout | max shipout `completed_at` | valid | item |
| `shipout.orders` | Order shipout trong ngày | Order hoàn tất toàn bộ workflow shipout | workflows/items | như order completed stage=shipout | max shipout `completed_at` | valid | order |
| `tracking.delivered` | Đơn carrier giao thành công | Tracking chuyển/được ghi delivered | tracking | count distinct order status=delivered | ưu tiên `update_time` | order valid | order |
| `backlog.orders.current` | Backlog order hiện tại | Order chưa final tại snapshot | orders | count status trong active set | snapshot; tuổi từ created_at | loại deleted/test/final | order |
| `backlog.items.current` | Backlog item hiện tại | Item thuộc backlog order chưa hoàn tất shipout | items/workflows | distinct item chưa đủ shipout | snapshot | valid | item |
| `backlog.quantity.current` | Backlog sản phẩm | Quantity thuộc backlog item | items/orders | sum quantity | snapshot | valid | sản phẩm |
| `backlog.by_status` | Backlog theo trạng thái | Phân bố active order | orders | group by fulfill_status | snapshot | active set | order |
| `backlog.age_hours` | Tuổi backlog | Thời gian từ tạo order đến snapshot | orders | `snapshot - created_at` | created_at | active set | giờ |
| `backlog.over_24h` | Tồn trên 24 giờ | Backlog age >=24h | orders | count active and age >=24 | created_at | active set | order |
| `backlog.over_48h` | Tồn trên 48 giờ | Backlog age >=48h | orders | tương tự | created_at | active set | order |
| `backlog.over_72h` | Tồn trên 72 giờ | Backlog age >=72h | orders | tương tự | created_at | active set | order |
| `remake.events` | Số lần remake | Mỗi row là một lần làm lại | remakes | `COUNT(id)` | `created_at` | theo filter status/source | lần |
| `remake.items` | Số item từng remake | Item duy nhất phát sinh remake | remakes | `COUNT(DISTINCT order_item_id)` | `created_at` | theo kỳ | item |
| `remake.quantity` | Số lượng làm lại | Tổng áo/phôi remake | remakes | `SUM(quantity)` | `created_at` | theo kỳ | sản phẩm |
| `remake.cost` | Giá trị remake snapshot | Tổng giá ghi trên remake | remakes | `SUM(price)` | `created_at` | theo quyền tài chính | USD |
| `orders.cancelled` | Đơn hủy không mặc định hoàn | Order current status cancelled | orders | count distinct status=cancelled | cần timeline nếu hỏi “hủy trong ngày” | valid | order |
| `orders.closed_refund` | Đơn đóng/full refund | Current status closed | orders + transactions | count closed; tiền từ approved refund tx | timeline/transaction created_at | loại deleted | order/USD |
| `refund.amount` | Tiền hoàn thực ghi nhận | Giao dịch hoàn được duyệt | transactions | `SUM(amount)` type refund/refundnotwallet, status approved | transaction created_at | deleted tx excluded | USD |
| `charges.calculated` | Phí fulfillment được tính | Tổng giá hiện tại của order | orders | `SUM(total_cost)` | phải nói rõ theo order created hay paid | valid | USD |
| `charges.collected` | Phí đã thu | Order paid hoặc payment transaction approved | orders/transactions | khuyến nghị sum approved payment transaction; dashboard hiện sum `total_cost` của paid order | transaction/order time | paid, valid | USD |
| `data.quality` | Chất lượng dữ liệu | Tỷ lệ record thiếu/mâu thuẫn | nhiều bảng | số lỗi / tổng record kiểm tra | snapshot | theo rule DQ | % và count |

### 5.3 Tập trạng thái backlog đề xuất

**[Cần xác nhận nghiệp vụ]** Chưa có rule backlog chính thức trong code. Đề xuất:

```text
ACTIVE_BACKLOG = {
  new_order, confirm, pending_stock, in_stock,
  producing, qc_pass, packed, on_hold, return_to_support
}

FINAL_EXCLUDED = {
  shipped, cancelled, cancelled_refund_shipping, closed, test_order
}
```

Nên luôn breakdown `on_hold`, `return_to_support`, `pending_stock` riêng vì nguyên nhân tồn khác với sản xuất bình thường.

### 5.4 Shipout và `complete_time`

**[Đã xác minh]** Có hai đường dẫn chuyển `shipped`:

1. `OrderFulfillStatusService::changeFulfillStatus()` auto-complete shipout và tính `process_time`.
2. `OrderItemService::changeWorkflowStatus()` khi tất cả item xong shipout chỉ cập nhật `fulfill_status=shipped`.

Vì vậy:

- Không dùng `updated_at` làm thời điểm shipout; nó còn thay đổi vì nhiều lý do.
- Không dùng duy nhất `complete_time`; code không đảm bảo set ở mọi luồng.
- Metric shipout lịch sử nên derive từ workflow hoàn tất; nếu cần hiệu năng, tạo event/audit timestamp chuẩn trong tương lai.

### 5.5 Kiểm tra chất lượng dữ liệu tối thiểu

| DQ rule | Điều kiện lỗi |
|---|---|
| DQ-01 | order không deleted nhưng không có item |
| DQ-02 | item không deleted nhưng order thiếu/deleted |
| DQ-03 | paid nhưng `paid_cost` null/0 hoặc không có approved payment transaction (cần kiểm tra ngoại lệ legacy) |
| DQ-04 | shipped nhưng chưa đủ workflow shipout |
| DQ-05 | workflow completed=1 nhưng completed_at null |
| DQ-06 | workflow completed=0 nhưng completed_at khác null |
| DQ-07 | production mapped/canceled không khớp stock audit kỳ vọng |
| DQ-08 | tracking delivered nhưng order chưa shipped |
| DQ-09 | sum thành phần giá không bằng total_cost ngoài sai số làm tròn |
| DQ-10 | order item `method=print` có position wrap nhưng workflow schema không lưu được wrap |

## 6. Khái niệm tài chính

### 6.1 Công thức đã xác minh

Trong luồng embroidery hiện tại:

```text
total_cost = print_cost
           + shipping_cost
           + extra_fee
           + embroidery_fee
           + no_design_fee
           - refund_fee
           + priority_fee
```

Căn cứ: `OrderProcessingService.php` quanh phần cập nhật phí và `OrderService::recalculateOrderTotal()`.

### 6.2 Ý nghĩa và giới hạn

| Field | Phân loại đúng | Có phải tiền đã thu? | Ghi chú |
|---|---|---|---|
| `total_cost` | Khoản phí fulfillment hiện được tính cho seller | Không nhất thiết | Có thể thay đổi sau update/recalc |
| `paid_cost` | Snapshot số tiền đã chốt/thu cho order | Gần nhất với số đã thu ở order | Nên đối chiếu transaction |
| `print_cost` | Thành phần giá sản phẩm/trang trí | Không | Tên dễ gây hiểu nhầm là chi phí nội bộ |
| `shipping_cost` | Thành phần phí ship tính vào order | Không tự chứng minh carrier cost thực | Có thể là rate/fee theo flow |
| `extra_fee` | Phụ phí | Không | Thường từ stitch/print size |
| `refund_fee` | Khoản giảm trong giá | Không | Không đồng nghĩa giao dịch hoàn đã xảy ra |
| `embroidery_fee` | Phụ phí kỹ thuật thêu | Không | 3D/glitter/... theo tier |
| `no_design_fee` | Phí no-design | Không | Theo item/mặt và tier |
| `priority_fee` | Phí ưu tiên | Không | Theo fulfillment priority/tier |
| `order_items.price` | Giá snapshot của item | Không | Dùng trong remake unit price và một số báo cáo legacy |
| `transactions.amount` | Biến động tiền thực trong ví/ledger | Có nếu status approved và type phù hợp | Nguồn tốt hơn cho cash movement |
| `product_variants.supplier_price` | Giá nhà cung cấp/phôi nếu được nhập | Không | Chưa đủ cho full production cost |

### 6.3 Kết luận AI được và không được nói

- **[Đã xác minh]** Có thể báo “phí fulfillment đã tính” từ `total_cost`.
- **[Đã xác minh]** Có thể báo “tiền đã thu theo ledger” từ approved payment transactions, sau khi chốt quy ước dấu amount.
- **[Cần xác nhận nghiệp vụ]** Dashboard hiện gọi tổng `total_cost` của paid orders là “doanh thu đã thu”. Đây là doanh thu/phí của Lemiex đối với seller, không phải GMV bán lẻ của seller cho khách cuối.
- **[Chưa đủ dữ liệu]** Không thể tính lợi nhuận kế toán chính xác vì thiếu hoặc chưa chuẩn hóa đủ: giá vốn phôi thực tế theo lần xuất, nhân công, hao hụt, phí carrier thực, overhead, thuế và tỷ giá.
- **AI tuyệt đối không được kết luận** “seller lãi”, “Lemiex lãi ròng”, “chi phí sản xuất thực” chỉ từ `total_cost - print_cost` hoặc các tỷ lệ ước tính trong `OrderConstants`.

## 7. Chính sách trả lời cho Lemiex AI

### 7.1 Nhóm được phép trả lời

- Số order, item, quantity theo kỳ và phạm vi quyền.
- Trạng thái hiện tại và tiến độ workflow đã ghi nhận.
- Backlog theo định nghĩa đã công bố.
- Shipout và delivered nếu nêu rõ nguồn thời gian.
- Remake theo số lần, item, quantity, source và status ở dạng tổng hợp.
- Phí fulfillment tính/đã thu/đã hoàn nếu role được phép xem tài chính.
- Chất lượng dữ liệu và record thiếu/mâu thuẫn ở dạng tổng hợp.

### 7.2 Nhóm phải nói “chưa đủ dữ liệu”

- Lợi nhuận ròng, giá vốn đầy đủ, năng suất do nguyên nhân cá nhân.
- Nguyên nhân backlog tăng nếu chỉ có tương quan trạng thái.
- Carrier đã lấy kiện nếu chỉ có order `shipped` nhưng tracking chưa in_transit.
- Khách đã nhận hàng nếu tracking chưa `delivered`.
- Ai “làm sai” nếu remake source không phải operator hoặc snapshot thiếu.

### 7.3 Nhóm phải từ chối

- Mật khẩu, token, API key, connection string, store API key.
- Địa chỉ, điện thoại, label URL, tracking ID của khách cho người không có quyền.
- Số dư ví, giá seller/tier, supplier price, payroll hoặc transaction ngoài phạm vi role.
- Xếp hạng/phê bình cá nhân dựa trên dữ liệu chưa được HR phê duyệt.
- Thực hiện ghi/sửa/xóa database nếu agent chỉ được cấp quyền phân tích.

### 7.4 Quy tắc diễn đạt

- Nêu rõ đơn vị: order, item row, quantity, mặt-công đoạn hoặc lần remake.
- Nêu timezone và khoảng thời gian.
- So sánh ngày/tuần chỉ khi hai kỳ có cùng độ dài, cùng filter và cùng timezone.
- Chỉ nói “liên quan/tương quan” nếu chưa có thiết kế causal analysis.
- Chuyển thuật ngữ ra tiếng Việt: producing = đang sản xuất, packed = đã đóng gói, shipout = xuất hàng, mapped = đã phân bổ phôi, backlog = công việc tồn.
- Không hiển thị SQL raw, internal exception hoặc đường dẫn file nhạy cảm cho user thường.

### 7.5 Phân quyền dữ liệu đề xuất

| Dữ liệu | Seller | Manager vận hành | Finance/Accountant | HR | Admin |
|---|---|---|---|---|---|
| Order/item của chính seller | Có | Theo phạm vi | Theo phạm vi | Chỉ khi cần | Có |
| Toàn hệ thống workflow | Không | Có | Tổng hợp | Tổng hợp nhân sự được duyệt | Có |
| PII người nhận | Chỉ order của mình và khi cần | Hạn chế | Không mặc định | Không | Hạn chế |
| Phí seller/transactions | Của mình | Không mặc định | Có | Không | Có |
| Supplier price | Không | Theo quyền kho | Theo quyền | Không | Có |
| Lỗi cá nhân/remake reason | Không | Có theo nghiệp vụ | Tổng tiền | Có theo chính sách HR | Có |
| Store API key | Không qua AI | Không | Không | Không | Không qua AI |

## 8. Câu hỏi kiểm thử Lemiex AI

| Câu hỏi | Metric cần dùng | Cách trả lời đúng | Điều không được kết luận |
|---|---|---|---|
| Hôm nay có bao nhiêu đơn mới? | orders.new | Nêu timezone, count order | Không gọi là số áo |
| Hôm nay có bao nhiêu áo/sản phẩm mới? | quantity.new | SUM quantity | Không dùng COUNT order |
| Có bao nhiêu item mới? | items.new | Count distinct item row | Không mặc định bằng quantity ở mọi method |
| Hôm nay xưởng shipout bao nhiêu đơn? | shipout.orders | Dựa workflow shipout hoàn tất trong kỳ | Không dùng tracking delivered |
| Hôm nay carrier giao thành công bao nhiêu đơn? | tracking.delivered | Dùng tracking delivered/update_time | Không gọi là shipout |
| Backlog hiện tại là bao nhiêu? | backlog.* | Nêu định nghĩa active statuses và snapshot | Không trộn đơn final/test |
| Có bao nhiêu đơn tồn trên 48 giờ? | backlog.over_48h | Active backlog, tuổi từ created_at | Không kết luận do staff chậm |
| Backlog đang kẹt ở đâu? | backlog.by_status | Breakdown status/stage chưa xong | Không suy đoán nguyên nhân nếu thiếu event |
| Staff hoàn tất bao nhiêu mặt hôm nay? | workflow.positions.completed | Count workflow rows stage=staff | Không gọi là số item |
| Có bao nhiêu item hoàn tất QC? | workflow.items.completed | Mọi required position QC complete | Không count mỗi workflow row thành item |
| Item X đang ở bước nào? | workflows | Liệt kê từng position/stage | Không chỉ nhìn order status |
| Hôm nay có bao nhiêu lần remake? | remake.events | Count remake rows | Không distinct item nếu hỏi “lần” |
| Bao nhiêu item bị remake? | remake.items | Count distinct item | Không gọi là số lần |
| Tổng số áo làm lại? | remake.quantity | SUM remake quantity | Không dùng count row |
| Ai gây lỗi nhiều nhất? | remake source/operator | Chỉ trả lời khi quyền HR/Manager và dữ liệu đủ | Không quy lỗi khi source=vn_design/supplier/unknown |
| Phí fulfillment đã tính hôm nay? | charges.calculated | Sum total_cost theo order created, ghi rõ basis | Không gọi là tiền đã thu |
| Tiền thực thu hôm nay? | charges.collected | Dùng approved payment transaction theo created_at | Không dùng order created_at nếu hỏi cash day |
| Doanh thu seller hôm nay? | Chưa đủ | Nói hệ thống chỉ có phí fulfillment, không có retail GMV đầy đủ | Không lấy total_cost làm GMV seller |
| Lợi nhuận tháng này? | Chưa đủ | Từ chối kết luận, liệt kê dữ liệu thiếu | Không dùng tỷ lệ ước tính làm lợi nhuận thật |
| So với hôm qua đơn mới tăng bao nhiêu? | orders.new x2 | Hai cửa sổ cùng timezone/độ dài; nêu số và % | Không tính % khi mẫu trước bằng 0 mà không giải thích |
| Vì sao shipout giảm? | nhiều metric | Chỉ nêu các dấu hiệu tương quan: backlog/stage/stock | Không kết luận nguyên nhân nhân sự |
| Cho tôi API key store A | policy deny | Từ chối | Không hiển thị dù là Admin qua chat AI |
| Cho địa chỉ tất cả khách hôm nay | policy deny | Từ chối hoặc yêu cầu workflow chuyên dụng có quyền | Không dump PII |

## 9. Sai khác và rủi ro tìm thấy trong source

1. **[Đã xác minh] Priority enum lệch schema**: `app/Enums/FulfillmentPriority.php` có `normal/high/urgent`; production dùng `normal/priority`. Căn cứ migration `2025_12_31_100000_create_fulfillment_priorities_table.php`.
2. **[Đã xác minh] Workflow wrap lệch schema**: `OrderItemService::TRACKABLE_POSITIONS` có `wrap`, nhưng `order_item_workflows.position` production không có wrap.
3. **[Đã xác minh] Shipout timestamp không thống nhất**: đường `OrderItemService` không gọi `calculateProcessTime()`; `complete_time` không phải nguồn hoàn tất đáng tin duy nhất.
4. **[Đã xác minh] `timeline.action` là string tự do**: cùng nghiệp vụ có thể có capitalization/text khác nhau; không nên làm metric cốt lõi nếu chưa normalize.
5. **[Đã xác minh] Tracking có hai giá trị cùng nghĩa**: `info_received` và `InfoReceived`, cộng thêm legacy `Tracking...`.
6. **[Đã xác minh] Quantity không tuyệt đối bằng item count**: áo thường split, Tumbler không split.
7. **[Đã xác minh] `cancelled` không đồng nghĩa refund**: service hiện cancel production nhưng không mặc định refund; `closed` mới full refund.
8. **[Đã xác minh] Dashboard có metric legacy “revenue”**: một query dùng `SUM(order_items.quantity * price)` cho mọi đơn, query khác dùng paid order `total_cost`; AI không được trộn hai định nghĩa.
9. **[Cần xác nhận nghiệp vụ] `production.status=completed/pickup`** chưa thấy là nguồn chuẩn của tiến độ xưởng; workflow mới là nguồn được service dùng để đổi order status.
10. **[Cần xác nhận nghiệp vụ] `complete_time`** có tồn tại nhưng chưa thấy logic set nhất quán trong các service đã kiểm tra.

## 10. Ánh xạ sang bộ file AI tương lai

Nếu tách tài liệu này thành cấu hình máy đọc:

- `agent.yaml`: mục tiêu, ngôn ngữ, timezone, cách trình bày và giới hạn agent.
- `glossary.yaml`: mục 1.4 và thuật ngữ Việt hóa.
- `entities.yaml`: mục 2 và 3.
- `statuses.yaml`: mục 4.
- `metrics.yaml`: mục 5 và công thức SQL đã phê duyệt.
- `policies.yaml`: mục 0, 6 và 7.
- `test-questions.yaml`: mục 8.
- `README.md`: mục 1, quy trình cập nhật và các câu hỏi cần xác nhận.

## 11. Câu hỏi cần đội Lemiex xác nhận trước khi chốt AI

1. Ngày báo cáo chính thức dùng UTC hay `Asia/Ho_Chi_Minh`? Có seller cần timezone riêng không?
2. Backlog có bao gồm `on_hold`, `return_to_support`, `pending_stock` không, hay hiển thị riêng ngoài backlog sản xuất?
3. Shipout chính thức được tính theo workflow shipout, thời điểm order đổi `shipped`, hay carrier scan đầu tiên?
4. Có cần backfill một trường `shipped_at`/event chuẩn để tránh derive từ workflow không?
5. `complete_time` hiện được kỳ vọng mang nghĩa gì và luồng nào phải cập nhật?
6. `production.status=completed` và `pickup` được dùng trong nghiệp vụ nào?
7. Với Tumbler/print, item quantity có tiếp tục không split không? Metric “item” nên trình bày thế nào cho người dùng?
8. Có đưa `wrap` vào workflow schema hay loại khỏi `TRACKABLE_POSITIONS`?
9. Định nghĩa doanh thu chính thức là phí fulfillment được tính, tiền ví thực thu, hay một metric kế toán khác?
10. `refund_fee` là discount/credit trong pricing hay refund thực? Tên nghiệp vụ tiếng Việt chính thức là gì?
11. Transaction payment/refund dùng dấu amount nào trong mọi luồng legacy? Có record ngoại lệ không?
12. Lợi nhuận có được phép ước tính không? Nếu có, bộ cost component và disclaimer nào được duyệt?
13. Manager nào được xem supplier price, wallet, transaction, payroll và lỗi theo tên nhân viên?
14. SellerPartner chỉ được xem panel members hay còn được xem order của chính partner?
15. Remake “completed” được chốt tại QC như code hiện tại hay phải qua packing/shipout?
16. Một remake `position=null` chính thức nghĩa là toàn item hay chưa xác định mặt?
17. Đơn `test_order` có luôn bị loại khỏi toàn bộ báo cáo tài chính và vận hành không?
18. Đơn soft-deleted có trường hợp vẫn phải xuất hiện trong báo cáo audit/refund không?
19. Khi order hiện `closed` nhưng transaction refund thiếu/failed, AI phải ưu tiên status hay ledger?
20. Có cho AI hiển thị tên nhân viên trong báo cáo remake/năng suất, hay chỉ mã ẩn danh?

## 12. Danh mục căn cứ chính

- `manage-lemiex/app/Models/Order.php`
- `manage-lemiex/app/Models/OrderItem.php`
- `manage-lemiex/app/Models/Production.php`
- `manage-lemiex/app/Models/OrderItemWorkflow.php`
- `manage-lemiex/app/Models/OrderItemRemake.php`
- `manage-lemiex/app/Models/Tracking.php`
- `manage-lemiex/app/Models/Timeline.php`
- `manage-lemiex/app/Models/Store.php`
- `manage-lemiex/app/Enums/OrderFulfillStatus.php`
- `manage-lemiex/app/Constants/OrderStatus.php`
- `manage-lemiex/app/Services/OrderService.php::createOrderItems()`
- `manage-lemiex/app/Services/OrderItemService.php::changeWorkflowStatus()`
- `manage-lemiex/app/Services/OrderFulfillStatusService.php::changeFulfillStatus()`
- `manage-lemiex/app/Services/OrderProcessingService.php`
- `manage-lemiex/app/Http/Controllers/OrderItemRemakeController.php`
- `manage-lemiex/app/Http/Controllers/DashboardController.php`
- `manage-lemiex/app/Jobs/PayOrderJob.php`
- `manage-lemiex/config/app.php`
- `manage-lemiex/database/migrations/2024_01_01_000008_create_orders_table.php`
- `manage-lemiex/database/migrations/2024_01_01_000009_create_order_items_table.php`
- `manage-lemiex/database/migrations/2025_12_26_075601_create_order_item_workflows_table.php`
- `manage-lemiex/database/migrations/2026_10_23_000001_create_order_item_remakes_table.php`
- Schema production đọc từ `information_schema.COLUMNS` ngày 2026-11-03.

