# Template thu thập và chuẩn hóa dữ liệu cho TikTok AI

> Phiên bản khảo sát schema: 14/11/2026 (Asia/Ho_Chi_Minh)  
> Nguồn đã kiểm tra chỉ đọc: `165.22.58.187:/var/www/feline`  
> Mục tiêu: tạo hợp đồng dữ liệu đủ rõ để TikTok AI trả lời chính xác về đơn hàng, team, seller, store, fulfillment, tiền và design.

## 1. Nguyên tắc bắt buộc

1. TikTok AI chỉ đọc dữ liệu qua view/API/tool đã kiểm soát, không được nhận quyền ghi vào database vận hành.
2. Mọi câu trả lời có số liệu phải kèm: phạm vi thời gian, múi giờ, nguồn dữ liệu, thời điểm dữ liệu được cập nhật và bộ lọc quyền đang áp dụng.
3. Không dùng một từ `doanh thu` cho nhiều loại tiền. Agent phải phân biệt rõ doanh số đơn, doanh thu ước tính, tiền TikTok quyết toán, tiền đã thanh toán và lợi nhuận vận hành.
4. Không gửi PII khách hàng, token TikTok, thông tin ngân hàng, proxy hoặc thông tin đăng nhập vào model.
5. Khi thiếu định nghĩa hoặc thiếu dữ liệu, Agent phải nói rõ thiếu gì; không tự suy diễn công thức.

## 2. Hiện trạng dữ liệu đã xác nhận

Số lượng dưới đây là ảnh chụp tại thời điểm khảo sát, không phải số cố định:

| Nhóm | Bảng chính | Quy mô quan sát | Ghi chú |
|---|---|---:|---|
| Đơn hàng | `orders` | khoảng 77.333 | Gần như toàn bộ là TikTok, có một lượng rất nhỏ Etsy |
| Sản phẩm trong đơn | `order_details` | khoảng 85.901 | Có SKU, variant, ảnh, giá bán, số lượng, personalization |
| Fulfillment | `order_fulfillments` | khoảng 76.255 | Có xưởng, giá fulfill, mã đơn xưởng, phương thức ship và ngày fulfill |
| Log sản xuất | `fulfill_logs` | khoảng 28.783 | Nối SKU với fulfillment; có bảng design và variant đi kèm |
| Store | `stores`, `tiktok_details` | 875 | Store owner, trạng thái, shop code, seller status và chỉ số shop |
| Team/nhân sự | `teams`, `users`, `user_details` | 13 team, 149 user | User nối team qua `user_details.team_id` |
| Design | `designs`, `design_details` | khoảng 8.555 | Có workflow, designer, file, mockup, score và thời gian làm việc |
| Phiên làm design | `design_work_sessions` | khoảng 574 | Có thời gian bắt đầu/kết thúc và số phút làm việc |
| Refund | `refunds` | khoảng 2.148 | Có số tiền, số lượng, loại, lý do, trạng thái và thời điểm Mỹ |
| Snapshot tài chính | `finance_monthly_snapshots` | khoảng 238 | Có payment, statement, fee, discount, tax và settlement |
| Ads | `ads` | 0 | Schema có nhưng chưa có dữ liệu tại thời điểm kiểm tra |
| Chi phí vận hành | `operate_expenses` | 0 | Chưa thể tính lợi nhuận doanh nghiệp đầy đủ |
| Yêu cầu tiền | `money_requests` | 0 | Chưa có dữ liệu thực tế để Agent khai thác |

Khoảng thời gian dữ liệu quan sát được:

| Dữ liệu | Từ | Đến |
|---|---|---|
| `orders.order_date` | 09/04/2025 | 13/11/2026 |
| `order_fulfillments.fulfillment_date` | 10/04/2025 | 14/11/2026 |
| `refunds.update_time_us` | 07/07/2025 | 13/11/2026 |
| `designs.created_at` | 10/04/2025 | 14/11/2026 |

## 3. Sơ đồ liên kết dữ liệu chuẩn

```text
teams.id
  <- user_details.team_id
  -> users.id = user_details.user_id
       -> stores.user_id
       -> orders.user_id
       -> designs.designer_id / designs.user_id_created

stores.id
  -> tiktok_details.store_id
       -> tiktok_details.shop_code = orders.shop_code

orders.order_id
  -> order_details.order_id
  -> order_fulfillments.order_id
  -> refunds.order_id
  -> refund_by_orders.order_id
  -> designs.order_id (chỉ các design có nguồn từ đơn)

order_fulfillments.fulfillment_unit_id
  -> fulfill_units.id

fulfill_units.id
  -> fulfill_logs.fulfillment_id              [đã xác nhận từ dữ liệu production]
       -> fulfill_log_designs.fulfill_log_id
       -> fulfill_log_variants.fulfill_log_id
```

### Khóa nghiệp vụ cần dùng

| Đối tượng | Khóa nội bộ | Khóa nghiệp vụ/tra cứu | Quy tắc |
|---|---|---|---|
| Đơn | `orders.id` | `orders.order_id` | Tra cứu cho người dùng bằng `order_id`; không dùng ID DB để giao tiếp |
| Store | `stores.id` | `tiktok_details.shop_code`, `store_details.account_code` | `shop_code` dùng để nối đơn; account code dùng trong vận hành |
| Seller | `users.id` | employee code/email nội bộ | Khi hiển thị chỉ dùng tên/employee code theo quyền |
| Team | `teams.id` | `teams.code` | Manager là `teams.manager_id`, không mặc định đồng nghĩa member |
| SKU | `order_details.sku_id` | SKU platform/seller | Phải xác nhận SKU có duy nhất theo store hay toàn hệ thống |
| Fulfillment record | `order_fulfillments.id` | `order_code`, `so_code`, tracking ở đơn | Có thể có nhiều fulfillment cho một order; khi tổng hợp phải group trước |
| Fulfillment vendor | `fulfill_units.id` | `fulfill_units.name` | `fulfill_logs.fulfillment_id` đang lưu vendor ID, không lưu `order_fulfillments.id` |
| Design | `designs.id` | `seller_SKU`, `external_item_id`, `order_id` | Không phải design nào cũng gắn với order |

## 4. Data dictionary theo miền nghiệp vụ

### 4.1. Đơn hàng

Nguồn chính: `orders`, `order_details`.

| Trường chuẩn cho Agent | Nguồn | Ý nghĩa cần chốt |
|---|---|---|
| `order_id` | `orders.order_id` | Mã đơn trên nền tảng |
| `platform` | `orders.platform` | TikTok/Etsy; TikTok Agent mặc định lọc `tiktok` |
| `sync_source` | `orders.sync_source` | `api`, `extension`, `manual`; dùng để đánh giá độ tin cậy/độ trễ |
| `seller_id` | `orders.user_id` | Seller chịu trách nhiệm đơn |
| `creator_id` | `orders.media_user_id` | Người/creator media nếu là creator order |
| `store_code` | `orders.shop_code` | Nối store qua `tiktok_details.shop_code` |
| `order_status` | `orders.order_status` | Trạng thái nội bộ/đang dùng chính |
| `platform_status` | `orders.platform_order_status` | Hiện gần như trống với TikTok; không dùng làm trạng thái chính trước khi sửa sync |
| `fulfill_status` | `orders.fulfill_status` | `Pending`, `On Hold`, `Fulfilled`, `Canceled` |
| `order_date` | `orders.order_date` | Đang mang wall-clock `America/Los_Angeles`; phải xử lý timezone nhất quán |
| `delivery_date` | `orders.delivery_date` | Ngày giao, có thể trống |
| `gross_order_amount` | `orders.total` | Tổng tiền đơn; chưa được gọi thẳng là doanh thu thực nhận |
| `estimated_revenue` | `orders.profit_price` | Tên hiện tại trong code là doanh thu ước tính, không phải profit cuối cùng |
| `stored_net_profit` | `orders.net_profit_price` | Thường bằng `profit_price - fulfill_price`; chưa chắc đã trừ refund/ads |
| `item_count` | `SUM(order_details.quantity)` | Tổng sản phẩm, khác số dòng order detail |
| `sku_count` | `COUNT(DISTINCT order_details.sku_id)` | Số SKU khác nhau |
| `tracking` | `orders.tracking` | Chỉ trả theo quyền và khi hỏi một đơn cụ thể |

Status hủy hiện được code nhận diện: `CANCEL`, `CANCELED`, `CANCELLED`.  
Status refund liên quan: `REFUND`, `RETURN_AND_REFUND`, đồng thời cần kiểm tra sự tồn tại trong `refunds`/`refund_by_orders`.

### 4.2. Team, seller và creator

Nguồn chính: `teams`, `users`, `user_details`, `departments`, `positions`.

| Trường chuẩn | Nguồn | Quy tắc |
|---|---|---|
| `team_id` | `user_details.team_id` | Team hiện tại của user |
| `team_manager_id` | `teams.manager_id` | Manager/leader của team |
| `seller_id` | `orders.user_id` | Owner của đơn và store |
| `creator_id` | `orders.media_user_id` | Dùng riêng cho creator/media attribution |
| `department_id` | `user_details.department_id` | Không thay thế team nếu nghiệp vụ đang tính theo team |
| `position_id` | `user_details.position_id` | Dùng cho phân quyền/nhóm KPI nếu được duyệt |
| `employment_period` | `join_date`, `leave_date` | Khi xem lịch sử không được loại seller đã nghỉ khỏi số liệu quá khứ |

Quy tắc cần giữ từ code hiện tại: thống kê lịch sử team vẫn bao gồm seller đã nghỉ; manager có thể được tính trong phạm vi team dù cách nối member khác user thường.

### 4.3. Store và tài khoản TikTok

Nguồn chính: `stores`, `store_details`, `tiktok_details`, `store_statuses`, `store_sources`, `tiktok_apps`.

| Nhóm | Trường cần cung cấp cho Agent | Không gửi vào model |
|---|---|---|
| Định danh | store ID, store name, account code, shop code, seller ID | Token, open ID nếu không thật sự cần |
| Sở hữu | owner user, media user, team | Email/điện thoại cá nhân nếu không cần |
| Trạng thái | status, member status, seller status, auth health, die/appeal/security | Chi tiết proxy |
| Vận hành | activation/deactivation date, source, tool version, last check | Access token, refresh token |
| Chỉ số | total product, today order, to ship, late/overdue, score, violation, limit | Dữ liệu ngân hàng chi tiết |
| Tài chính tóm tắt | paid, processing, on hold, settlement state | Card/bank credentials |

Phải tạo bảng mapping ID -> nhãn cho `stores.status_id` và mã -> nhãn cho `tiktok_details.seller_status`. Agent không được đọc số `5`, `7`, `2`, `3` rồi tự đoán ý nghĩa.

### 4.4. Fulfillment

Nguồn chính: `order_fulfillments`, `fulfill_units`, `fulfill_unit_details`, `fulfill_logs`, `fulfill_log_designs`, `fulfill_log_variants`.

Các đơn vị fulfillment đang hoạt động gồm Lemiex API/V2, FlashShip, Gearment, Pressify, Print Arrows, Printify, Gum Prints, Mango, Monkey King Print, Pressify Unico và PrintDoors.

| Trường chuẩn | Nguồn | Ý nghĩa |
|---|---|---|
| `fulfillment_id` | `order_fulfillments.id` | Bản ghi fulfillment nội bộ |
| `order_id` | `order_fulfillments.order_id` | Nối đơn |
| `vendor_id` | `fulfillment_unit_id` | Xưởng/vendor |
| `vendor_order_code` | `order_code` | Mã đơn ở vendor |
| `so_code` | `so_code` | Mã SO nếu có |
| `fulfill_cost` | `fulfill_price` | Chi phí fulfillment |
| `shipping_method` | `shipping_method` | Phương thức giao |
| `fulfilled_at` | `fulfillment_date` | Ngày fulfill chính |
| `fulfilled_at_texas` | `fulfillment_date_texas` | Cần xác nhận có còn dùng và timezone |
| `variant_cost` | `fulfill_unit_details.price` | Bảng giá theo type/model/color/size/variant/vendor |
| `production_variant` | `fulfill_log_variants.*` | Variant thực tế gửi xưởng |
| `production_design` | `fulfill_log_designs.*` | File/mặt in thực tế gửi xưởng |

Lưu ý chất lượng: tại thời điểm kiểm tra có khoảng 283 fulfillment thiếu `fulfill_price` và 5 bản ghi thiếu `fulfillment_date`. Các báo cáo tiền phải hiển thị thêm `missing_cost_orders` và không được coi giá thiếu là bằng 0 mà không cảnh báo.

Kiểm tra production ngày 14/11/2026 cho thấy toàn bộ 28.787 `fulfill_logs` nối được với `fulfill_units.id`, trong khi không có bản ghi nào nối `fulfill_logs.fulfillment_id` với `order_fulfillments.id`. Vì vậy tên cột `fulfillment_id` trong `fulfill_logs` là tên legacy dễ gây hiểu nhầm; lớp dữ liệu cho AI phải đổi tên logic thành `vendor_id`.

### 4.5. Tiền, doanh thu và lợi nhuận

Nguồn: `orders`, `order_details`, `order_fulfillments`, `refunds`, `ads`, `finances`, `finance_monthly_snapshots`.

#### Từ điển metric tiền bắt buộc

| Tên metric chuẩn | Công thức/nguồn | Cách diễn giải |
|---|---|---|
| `gross_order_value` | `SUM(orders.total)` | Tổng giá trị đơn trong kỳ |
| `item_net_sales` | `SUM(order_details.sale_price * quantity)` sau quy tắc loại refund hiện hành | Doanh số sản phẩm theo chi tiết đơn |
| `estimated_revenue` | `SUM(orders.profit_price)` | Doanh thu/tiền ước tính trong hệ thống, không gọi là lợi nhuận ròng |
| `fulfillment_cost` | `SUM(order_fulfillments.fulfill_price)` sau khi group theo order | Tổng chi phí fulfillment |
| `refund_amount` | `SUM(refunds.amount)` theo `refunds.update_time_us` | Refund phát sinh trong kỳ, không phụ thuộc ngày tạo đơn |
| `ads_spend` | `SUM(ads.top_up_amount)` theo `top_up_date`, loại `rejected` | Chi phí ads được ghi nhận; hiện bảng chưa có dữ liệu |
| `operational_contribution` | `estimated_revenue - fulfillment_cost - refund_amount - ads_spend` | Công thức đang dùng cho team/seller performance |
| `stored_net_profit` | `SUM(orders.net_profit_price)` | Giá trị lưu sẵn; thường chưa trừ refund và ads |
| `statement_settlement` | `finance_monthly_snapshots.statement_settlement` | Tiền quyết toán theo statement TikTok |
| `statement_fee` | snapshot `statement_fee` | Phí statement |
| `paid_amount` | snapshot/finance `paid` | Tiền đã thanh toán |
| `cash_on_hold` | `finances.on_hold` | Tiền đang giữ |
| `cash_processing` | `finances.processing` | Tiền đang xử lý |
| `settlement_after_fulfillment` | `statement_settlement - fulfillment_cost` | Cách tính đang dùng ở báo cáo finance snapshot |

#### Quy tắc chọn nguồn

- Câu hỏi “đơn hôm nay bán được bao nhiêu”: trả `gross_order_value` và/hoặc `estimated_revenue`, ghi rõ tên từng số.
- Câu hỏi “TikTok thực trả bao nhiêu”: ưu tiên snapshot/payment/statement, không dùng `orders.total`.
- Câu hỏi “lãi bao nhiêu”: chỉ trả khi nói rõ cấp độ. Tối thiểu hiển thị cả `stored_net_profit` và `operational_contribution` nếu dữ liệu ads/refund đủ.
- Câu hỏi “lợi nhuận cuối cùng công ty”: hiện chưa đủ vì ads và chi phí vận hành chưa có dữ liệu. Phải trả lời là chưa thể kết luận.
- Với đơn hủy, code hiện đặt `profit_price = 0` và `net_profit_price = -fulfill_price`.

### 4.6. Refund/return

Nguồn: `refunds`, `refund_by_orders`, các timeline liên quan.

Agent cần phân biệt:

- Loại: `Return and refund`, `Refund only`, `Replacement`.
- Trạng thái quy trình và trạng thái hoàn tất.
- Số tiền refund, shipping fee, số lượng item, lý do.
- Ngày phát sinh theo `update_time_us` (giờ Mỹ) thay vì chỉ theo ngày order.
- Tỷ lệ refund theo số đơn và theo số item.
- Refund cost theo team/store/seller/SKU/product/vendor fulfillment.

### 4.7. Design

Nguồn: `designs`, `design_details`, `design_work_sessions`, `design_requests`, `design_spies`.

| Nhóm | Trường/metric |
|---|---|
| Định danh | design ID, seller SKU, external item ID, order ID |
| Nội dung | name, description, niche, type, source type/method |
| File | mockup front/back, các file design/EMB và preview theo từng mặt |
| Workflow | status, progress, work status, priority, paused reason |
| Người phụ trách | designer, creator, priority assigner |
| Thời gian | booked, started, completed, total worked minutes, work sessions |
| Chất lượng | score, approve/fix status, file completeness |
| Sản xuất | print, side, both, flashship, variant info/side label |

KPI tối thiểu:

- Design được giao, đã hoàn thành, đang làm, chưa bắt đầu, priority, bị pause.
- Thời gian xử lý trung bình/median/P90 từ booked -> started -> completed.
- Tổng phút thực làm và số phiên làm việc.
- Tỷ lệ approve, fix/rework và điểm trung bình.
- Backlog theo designer/team/niche/source.
- Design gắn đơn và design độc lập phải được báo cáo riêng.

Hiện phần lớn design có `progress = Spy`, khoảng 6.843 design không gắn `order_id`, và 331 design chưa có `designer_id`; do đó không được mặc định mọi design là yêu cầu sản xuất từ đơn.

## 5. Bộ câu hỏi doanh nghiệp cần xác nhận

Các câu trả lời dưới đây được điền theo code, dữ liệu production và quyết định đã có đến ngày 14/11/2026.

- **Đã xác nhận:** có bằng chứng trực tiếp từ code/schema/dữ liệu và có thể dùng để triển khai.
- **Quy tắc hiện tại:** hệ thống đang chạy như vậy, nhưng chưa chắc là chính sách kế toán/nghiệp vụ cuối cùng.
- **Cần chốt:** chưa đủ bằng chứng để AI tự quyết; phải giữ cảnh báo hoặc chưa mở metric tương ứng.

Đây là phần bắt buộc phải được chủ hệ thống duyệt trước khi cho TikTok AI trả lời số liệu tài chính ở production.

### 5.1. Đơn hàng và thời gian

| Câu hỏi | Trả lời chính thức |
|---|---|
| Một đơn “mới” được tính theo `order_date`, `created_at` hay thời điểm sync? | **Đã xác nhận:** metric đơn mới/bán hàng dùng `orders.order_date`. `created_at` chỉ phản ánh lúc bản ghi vào Felineez; `sync_source` dùng để đánh giá nguồn và độ trễ sync. |
| Ngày báo cáo mặc định dùng America/Los_Angeles, Asia/Ho_Chi_Minh hay timezone của từng shop? | **Quy tắc hiện tại:** đơn hàng, seller, store và tiền theo `America/Los_Angeles`; KPI design theo `Asia/Ho_Chi_Minh`. Chưa có timezone riêng từng shop. Tool phải khai báo domain và timezone, không trộn hai miền trong cùng cửa sổ ngày. |
| Ranh giới “hôm nay” được chốt lúc mấy giờ và theo múi giờ nào? | **Đã xác nhận cho đơn hàng:** `00:00:00–23:59:59 America/Los_Angeles`. **Đã xác nhận cho design:** `00:00:00–23:59:59 Asia/Ho_Chi_Minh`. Nên triển khai cửa sổ nửa mở `[start, next_day_start)` sau khi quy đổi về DB. |
| Replacement order có tính vào số đơn/doanh thu/KPI seller không? | **Quy tắc hiện tại:** `is_replacement_order` tồn tại nhưng các thống kê đơn tổng quát chưa loại mặc định, nên replacement đang có thể bị tính như đơn thường. **Cần chốt:** đề xuất tách riêng và mặc định loại khỏi new-sales/revenue, vẫn tính vào volume vận hành và chi phí fulfillment. |
| Creator order được tính cho seller, media user hay chia attribution? | **Đã xác nhận:** owner vận hành và doanh số seller dùng `orders.user_id`; attribution creator/media dùng riêng `orders.media_user_id` khi `is_creator_order = 1`. Báo cáo chung không được cộng cả hai thành hai đơn; chỉ trình bày hai chiều attribution trên cùng tập đơn. |
| Đơn clone có loại khỏi số liệu không? Quy tắc theo `clone_group_id` là gì? | **Quy tắc hiện tại:** clone không bị loại khỏi tổng số đơn; `clone_group_id`/`cloned_from_order_id` chủ yếu dùng truy vết và tìm kiếm cả nhóm. Khi báo cáo unique demand phải group theo `COALESCE(clone_group_id, order_id)`; báo cáo production/fulfillment vẫn đếm từng order thực tế. |
| Trạng thái nào được tính là bán thành công, shipped, completed và canceled? | **Đã xác nhận một phần:** canceled gồm `CANCEL`, `CANCELED`, `CANCELLED` ở `order_status` hoặc `platform_order_status`; refund-related gồm `REFUND`, `RETURN_AND_REFUND`. Fulfillment hoàn tất dùng `fulfill_status = Fulfilled`. **Cần chốt:** chưa có enum thống nhất cho “bán thành công/shipped/completed” ở cấp order; trước mắt AI phải trả theo từng trường trạng thái và nêu filter. |
| Một order có nhiều fulfillment thì cách chia item và chi phí thế nào? | **Đã xác nhận:** số đơn dùng `COUNT(DISTINCT orders.id)`; chi phí dùng tổng các `order_fulfillments.fulfill_price` theo order. Chưa có khóa item-allocation chắc chắn giữa từng `order_detail` và từng fulfillment; không tự chia item/chi phí theo tỷ lệ nếu thiếu mapping production. |

### 5.2. Tiền

| Câu hỏi | Trả lời chính thức |
|---|---|
| `orders.profit_price` thực chất được lấy từ API nào và đã trừ những khoản gì? | **Đã xác nhận cho luồng TikTok Partner mới:** tổng `settlement_amount` của statement transactions theo order. Dữ liệu legacy có thể đến từ API/sync cũ hoặc nhập tay; Etsy dùng `net_earnings`. Vì vậy phải kèm `platform`, độ phủ transaction và thời điểm sync; chưa được coi mọi record là cùng một công thức. |
| `orders.net_profit_price` có cam kết luôn bằng profit - fulfillment không? | **Quy tắc hiện tại:** mục tiêu là `profit_price - SUM(fulfill_price)`; đơn canceled là `-SUM(fulfill_price)`. Có command đối soát/recalculate, nhưng record có thể stale giữa các lần sync và một số luồng cũ chỉ đọc một fulfillment. AI nên tính động khi có thể và cảnh báo nếu lệch giá trị lưu. |
| “Doanh thu” mặc định của sếp muốn xem là gross order, estimated revenue hay settlement? | **Quy tắc trình bày:** không dùng nhãn “doanh thu” đơn độc. Mặc định dashboard vận hành trả `estimated_revenue = SUM(profit_price)`; câu hỏi tiền TikTok thực trả dùng statement settlement; câu hỏi sức bán dùng gross order value. Nếu người dùng chỉ hỏi “doanh thu”, AI phải hiển thị tên metric và hỏi/chú thích basis. |
| Refund tính ở kỳ order hay kỳ refund phát sinh? | **Đã xác nhận:** tính ở kỳ refund phát sinh theo `refunds.update_time_us` (giờ Mỹ), không theo `orders.order_date`. Có thể bổ sung cohort theo kỳ order như một phân tích riêng. |
| Phí ads chính thức lấy từ đâu khi bảng `ads` chưa có dữ liệu? | **Cần chốt:** chưa có nguồn production đủ dùng. Không suy ra ads từ order/snapshot và không tính lợi nhuận cuối cùng; trả `ads_spend = unavailable` kèm cảnh báo coverage. |
| Có phí affiliate, creator commission, transaction fee, tax hoặc shipping subsidy nào chưa nằm trong snapshot? | **Cần chốt với tài chính:** snapshot có các nhóm statement fee/discount/tax/settlement nhưng chưa chứng minh độ phủ toàn bộ affiliate, creator commission và subsidy. Tool phải trả breakdown trường nguồn, không gộp thành “đã trừ hết phí”. |
| Chi phí fulfillment dùng giá dự kiến hay hóa đơn thực tế? | **Đã xác nhận:** báo cáo thực tế dùng `order_fulfillments.fulfill_price`, lấy từ vendor API hoặc giá được cập nhật vào bản ghi fulfillment. `fulfill_unit_details.price` chỉ là bảng giá chuẩn/dự kiến để kiểm tra chênh lệch. Null phải báo thiếu, không tự thay bằng bảng giá. |
| Currency có luôn là USD không? Nếu nhiều currency thì tỷ giá lấy ở đâu và chốt lúc nào? | **Quy tắc hiện tại:** phần lớn nghiệp vụ TikTok/fulfillment đang vận hành như USD nhưng `orders.currency` vẫn tồn tại và chưa có bảng tỷ giá chuẩn. AI chỉ được cộng tiền cùng currency; nếu có nhiều currency phải tách nhóm và báo chưa có conversion policy. |
| Công thức lợi nhuận cuối cùng được CFO/kế toán duyệt là gì? | **Cần chốt:** chưa có công thức được duyệt và dữ liệu ads/operating expenses còn trống. Hiện chỉ được gọi `operational_contribution = estimated_revenue - fulfillment_cost - refund_amount - ads_spend`; không gọi là lợi nhuận cuối cùng công ty. |
| Khi snapshot và dữ liệu order lệch nhau, nguồn nào có quyền ưu tiên? | **Quy tắc hiện tại:** statement/snapshot ưu tiên cho tiền quyết toán/đã trả; order ưu tiên cho vận hành và attribution seller/team/store. Không ghi đè một nguồn bằng nguồn kia; báo cả hai, coverage và chênh lệch. |

### 5.3. Team, seller và store

| Câu hỏi | Trả lời chính thức |
|---|---|
| Manager có được tính như một seller trong team không? | **Đã xác nhận:** có, nếu manager có order/store. Truy vấn team hiện cộng cả member từ `user_details.team_id` và manager từ `teams.manager_id`; phải distinct user để tránh trùng. |
| Seller chuyển team giữa tháng thì doanh số lịch sử thuộc team cũ hay team mới? | **Quy tắc hiện tại:** thuộc team hiện tại vì chỉ có `user_details.team_id`, chưa có lịch sử membership theo hiệu lực. Đây là rủi ro sai số lịch sử; cần thêm `team_membership_history(valid_from, valid_to)` trước khi AI cam kết attribution quá khứ. |
| Một store có thể đổi owner không và có bảng lịch sử ownership không? | **Đã xác nhận:** `stores.user_id` có thể được cập nhật; chưa thấy bảng lịch sử ownership. Báo cáo quá khứ hiện quy về owner/team hiện tại, trừ khi bổ sung snapshot lịch sử. |
| Store chết/deactivate có giữ trong ranking lịch sử không? | **Quy tắc chính thức đề xuất từ code hiện tại:** giữ trong báo cáo lịch sử nếu store có dữ liệu trong kỳ; chỉ loại khỏi selector/vận hành hiện tại khi inactive. Luôn hiển thị trạng thái hiện tại cạnh kết quả lịch sử. |
| Mapping chính thức của mọi `status_id` và `seller_status` là gì? | **Đã trích production:** xem bảng mapping ngay dưới mục này. `seller_status = 2` chỉ được code coi là Live khi `shop_status = 2`; `seller_status = 3` chưa có nhãn nghiệp vụ được xác minh, nên AI không được tự đặt tên. |
| KPI team ưu tiên order count, item count, settlement hay contribution profit? | **Quy tắc hiện tại:** không có một KPI duy nhất. Dashboard phải hiển thị tối thiểu orders, fulfilled orders, estimated revenue, fulfillment cost, refund, ads coverage và operational contribution. Ranking theo tiền chỉ mở khi coverage đủ; ranking volume phải ghi rõ order hay item. |
| Những role nào được xem tiền của seller khác/team khác? | **Đã xác nhận từ code:** Super Admin xem toàn phạm vi được cấu hình; Leader/manager xem tiền team mình quản lý; user thường chỉ xem tiền của chính mình, trừ grant/dashboard-team access riêng. AI phải áp dụng role + agent grant + data scope, không chỉ role name. |

#### Mapping trạng thái store đã xác nhận từ production

| `stores.status_id` | Tên | Ghi chú nghiệp vụ đang lưu |
|---:|---|---|
| 5 | Active | Store đang hoạt động |
| 7 | Inactive | Store không hoạt động |
| 23 | Non - Complain | Báo tiền không về |
| 24 | IPR 1 | Lần 1 |
| 25 | Identity Verification Required | Hold tiền 365 ngày |
| 26 | IPR 2 | Tiền không về, đóng shop vĩnh viễn |
| 27 | IPR 2 | Thanh toán và rút tiền bị tạm dừng |
| 28 | IPR 1 | Tiền bị tạm giữ 90 ngày |
| 29 | Account Deactivated | Không có ghi chú chuẩn |
| 30 | Account Deactivated | Đóng băng tiền 90 ngày |
| 31 | Account Deactivated | Đóng shop vĩnh viễn, thanh toán/rút tiền bị tạm dừng |
| 32 | Account Deactivated | Unable to verify ID Information |
| 33 | Account Deactive | Identity Re-Verification Required |
| 34 | Account Deactived | Potential Connection to a Deactivated Store |

Tên trạng thái 29–34 đang không đồng nhất chính tả nhưng khác nhau ở `note`; lớp semantic cho AI phải giữ cả `status_id`, `name`, `note`, đồng thời chuẩn hóa một `status_group` riêng thay vì gộp mất nguyên nhân.

| `tiktok_details.seller_status` | Mapping được phép dùng |
|---:|---|
| 2 | Chỉ gọi **Live** khi đồng thời `shop_status = 2` theo logic hiện tại |
| 3 | **Chưa xác nhận nhãn nghiệp vụ**; chỉ trả mã hoặc mapping sau khi TikTok owner duyệt |
| null | Chưa có dữ liệu trạng thái |

### 5.4. Fulfillment

| Câu hỏi | Trả lời chính thức |
|---|---|
| `fulfill_logs.fulfillment_id` có chắc chắn trỏ tới `order_fulfillments.id` không? | **Đã xác nhận là không.** Production có 28.787/28.787 log nối với `fulfill_units.id` và 0 log nối với `order_fulfillments.id`. Tên logic đúng là `vendor_id`. |
| Vendor nào là xưởng nội bộ, vendor nào là đối tác ngoài? | **Quy tắc hiện tại:** các unit Lemiex, FlashShip, Gearment, Pressify, Print Arrows, Printify, Gum Prints, Mango, Monkey King Print, Pressify Unico và PrintDoors được vận hành như vendor/xưởng tích hợp bên ngoài. Chưa có cờ schema `is_internal`; nếu có xưởng nội bộ phải bổ sung metadata thay vì suy từ tên. |
| Chi phí thiếu/null xử lý thế nào trong báo cáo? | **Đã xác nhận:** `SUM` không cộng null, đồng thời bắt buộc trả `missing_cost_orders`/`missing_cost_records` và cảnh báo tổng tiền chưa đầy đủ. Không đổi null thành 0 trong lớp semantic. |
| SLA fulfill tính từ order date, paid date hay thời điểm gửi xưởng? | **Cần chốt:** hệ thống chưa có một mốc `sent_to_vendor_at` chuẩn cho mọi vendor. Đề xuất SLA intake dùng `order_date -> order_fulfillments.created_at`; SLA production dùng `created_at -> shipped/completed vendor event` khi có. Không gọi một trong hai là SLA chính thức trước khi duyệt. |
| Late fulfillment được định nghĩa theo bao nhiêu giờ/ngày và theo loại ship nào? | **Cần chốt:** chưa có bảng SLA theo vendor/product/shipping method. AI chỉ được trả elapsed time và backlog age; chưa được gắn nhãn late nếu không nhận threshold cấu hình. |
| `fulfillment_date_texas` còn là nguồn chính thức không? | **Quy tắc hiện tại:** vẫn được ghi bằng `America/Chicago` nhưng là trường legacy/phụ. Bộ lọc “Fulfilled Since/To Date” mới dùng `order_fulfillments.created_at`; `fulfillment_date` dùng cho hiển thị legacy. Không dùng Texas date làm mặc định. |
| Đơn cancel sau khi đã sản xuất tính chi phí và KPI lỗi cho bên nào? | **Đã xác nhận phần tiền:** vẫn giữ fulfillment cost; `profit_price = 0`, `net_profit_price = -fulfillment_cost`. **Cần chốt phần trách nhiệm/KPI lỗi:** schema chưa đủ để tự quy seller, designer hay vendor; phải dựa reason/timeline/remake source được duyệt. |
| Variant price là giá chuẩn hay giá theo từng lần fulfill? | **Đã xác nhận:** `fulfill_unit_details.price` là giá chuẩn/catalog; `order_fulfillments.fulfill_price` là giá ghi nhận cho lần fulfill và là nguồn báo cáo thực tế. Chênh lệch phải xuất thành data-quality/reconciliation metric. |

### 5.5. Design

| Câu hỏi | Trả lời chính thức |
|---|---|
| Workflow chuẩn và thứ tự hợp lệ của `progress`/`work_status` là gì? | **Đã xác nhận cho work tracking:** `pending -> booked -> in_progress -> completed`; nhánh tạm dừng gồm `paused`, `priority_paused`; design completed có thể mở lại thành `fix`, sau đó làm và complete lại. `progress` là workflow nội dung legacy/nguồn, không được dùng thay `work_status` để tính phiên làm việc. |
| Design `Spy` có được tính vào năng suất designer không? | **Quy tắc hiện tại:** có nếu design có designer và `completed_at` nằm trong kỳ; KPI hiện chỉ tách bằng `source_type` khi người dùng chọn, không tự loại `progress = Spy`. **Cần chốt:** nếu Spy là research không tương đương production design thì phải tạo metric riêng. |
| Khi nào một design được coi là hoàn tất: upload file, approve hay gửi xưởng? | **Đã xác nhận:** khi action complete chuyển `work_status = completed` và ghi `completed_at`. `completed_at` giữ lần hoàn thành đầu tiên, không đổi khi design được reopen/fix rồi complete lại. Approve hoặc gửi xưởng là trạng thái khác, không thay mốc KPI hoàn thành. |
| KPI dùng thời gian calendar hay `total_worked_minutes` từ work session? | **Đã xác nhận:** lọc design trong kỳ theo `completed_at`; đo thời gian thực làm bằng tổng `total_worked_minutes` cộng phiên đang mở. Calendar cycle time booked/start/completed là metric SLA riêng, không thay worked minutes. |
| Fix/rework được xác định bằng trường nào và thuộc trách nhiệm ai? | **Đã xác nhận:** `work_status = fix`, `paused_reason = fix_requested`; chỉ Admin/HR/Fulfillment được request fix. Design vẫn gắn `designer_id`; chưa có trường chuẩn lưu người/bộ phận gây lỗi, nên AI không được quy trách nhiệm chỉ từ người đang sửa. |
| Score do ai chấm, thang điểm nào và có version rubric không? | **Đã xác nhận:** chỉ Admin được chấm; giá trị hợp lệ `0, 0.25, 0.5, 1, 2, 3, 4`, trong đó 0 là chưa chấm. Quy định KPI Q4/2026 tính tổng điểm theo ngày công (full-time 14 điểm/ngày; part-time 16 điểm/ngày hoặc 8 điểm/1 ca). **Cần bổ sung:** rubric/version giải thích vì sao một design nhận từng mức điểm. |
| File nào bắt buộc theo từng loại sản phẩm/phương pháp in-thêu? | **Cần chốt:** schema có file theo front/back/sleeve và bản EMB/preview nhưng chưa có ma trận bắt buộc theo product + print method. Trước mắt AI chỉ báo file hiện có/thiếu, không tự kết luận “đủ để sản xuất” nếu chưa có rule catalog. |

## 6. Bộ metric TikTok AI nên triển khai

### 6.1. Tổng quan điều hành

- Số đơn, số item, số SKU và số store có đơn.
- Gross order value, estimated revenue, settlement, fulfillment cost, refund, ads và contribution profit.
- So sánh kỳ trước theo giá trị tuyệt đối và phần trăm.
- Cảnh báo chi phí thiếu, dữ liệu sync trễ và store mất kết nối.
- Top/bottom team, seller, store, SKU và fulfillment vendor.

### 6.2. Đơn hàng

- Intake theo giờ/ngày/tuần, trạng thái và nguồn sync.
- Backlog chưa fulfill, on hold, overdue, canceled, replacement.
- Tra cứu đơn theo `order_id`, tracking, shop code, SO code và vendor order code.
- Chi tiết item/SKU/variant/personalization và hành trình fulfillment.
- Đơn âm lợi nhuận, refund, thiếu tracking, thiếu giá fulfill.

### 6.3. Team và seller

- Orders/items/revenue/cost/refund/ads/profit theo team và seller.
- Fulfillment rate, cancel rate, refund rate, average order value.
- Store active/die/appeal/auth issue theo owner.
- Creator order performance theo seller và media user riêng biệt.
- Ranking phải kèm minimum sample size để tránh xếp hạng sai trên mẫu quá nhỏ.

### 6.4. Fulfillment

- Volume và cost theo vendor, product type, variant, store, team.
- Cost/order, cost/item, thời gian fulfill và SLA breach.
- Missing price, missing vendor order code, đơn chưa có fulfillment.
- Cancel/refund rate theo vendor và variant.
- Đối soát giá thực tế với `fulfill_unit_details`.

### 6.5. Store

- Store active/dead/deactivated/appeal/security/auth status.
- Orders, revenue, settlement, refund và profit theo store.
- Store không có đơn bất thường, giảm doanh số, ship late/overdue.
- Token/auth sắp hết hạn chỉ tạo cảnh báo hệ thống; tuyệt đối không đưa token vào câu trả lời.

### 6.6. Design

- Backlog, throughput, cycle time, worked time và SLA.
- KPI theo designer/team/niche/source/method.
- File completeness, fix/rework, score và priority queue.
- Liên kết design -> order -> fulfillment -> refund để đo ảnh hưởng chất lượng.

## 7. Tool/API chỉ đọc đề xuất cho TikTok AI

Agent không truy cập SQL tùy ý. Mỗi tool phải nhận `scope`, `date_range`, `timezone`, `filters` và trả `data_as_of`, `source`, `quality_warnings`.

| Tool | Mục đích | Bộ lọc chính |
|---|---|---|
| `tiktok.overview.get` | Tổng quan điều hành | date range, team, seller, store, platform |
| `tiktok.orders.search` | Tìm/tra cứu đơn | order ID, tracking, SO, shop, SKU, status |
| `tiktok.orders.metrics` | Metric đơn/item/status | period, timezone, attribution |
| `tiktok.money.summary` | Các lớp doanh thu/chi phí/lợi nhuận | accounting basis, date type, scope |
| `tiktok.team.performance` | KPI team/seller | team, seller, metric, comparison period |
| `tiktok.stores.health` | Sức khỏe store | status, auth, owner, team, anomaly |
| `tiktok.fulfillment.metrics` | Volume/cost/SLA/vendor | vendor, status, product, missing cost |
| `tiktok.design.metrics` | Workflow và KPI design | designer, team, status, source, method |
| `tiktok.refunds.metrics` | Refund/return/replacement | refund date, reason, SKU, store, vendor |
| `tiktok.data.quality` | Kiểm tra độ đầy đủ và độ trễ | domain, severity, date range |

Mẫu response tối thiểu:

```json
{
  "metric": "operational_contribution",
  "value": 0,
  "currency": "USD",
  "date_range": {
    "from": "2026-11-14T00:00:00-08:00",
    "to": "2026-11-14T23:59:59-08:00",
    "timezone": "America/Los_Angeles"
  },
  "scope": {"team_ids": [], "store_ids": []},
  "formula": "estimated_revenue - fulfillment_cost - refund_amount - ads_spend",
  "source": ["orders", "order_fulfillments", "refunds", "ads"],
  "data_as_of": "2026-11-14T14:30:00+07:00",
  "quality_warnings": []
}
```

## 8. Phân quyền dữ liệu

| Phạm vi | Admin | Manager | User |
|---|---|---|---|
| Toàn bộ team/store/seller | Có | Không | Không |
| Team được cấp | Có | Có | Theo grant |
| Dữ liệu cá nhân | Có | Có trong team | Có |
| Tiền tổng hợp | Có | Theo grant Agent/data | Theo grant cụ thể |
| Chi tiết salary/payroll | Grant riêng | Mặc định không | Không |
| PII khách hàng | Chỉ khi có lý do nghiệp vụ | Mask mặc định | Mask mặc định |
| Token TikTok/proxy/bank/card | Không đưa qua AI | Không | Không |
| File design | Theo scope team/store/order | Theo scope | Theo assignment/grant |

Mọi tool call phải lưu audit: user, role, grant, câu hỏi, tool, filter, số dòng, thời gian, lỗi, model, token và chi phí. Không ghi raw token/PII vào log.

## 9. Kiểm tra chất lượng trước khi phát hành

- [ ] Có mapping đầy đủ store status và seller status.
- [ ] Chốt múi giờ mặc định và quy tắc “hôm nay”.
- [ ] Chốt định nghĩa 5 lớp tiền trong mục 4.5.
- [ ] Không double count order có nhiều fulfillment.
- [ ] Có cảnh báo fulfillment thiếu giá.
- [ ] Có báo cáo coverage của finance snapshot theo store/tháng.
- [ ] Có nguồn ads và operating expenses thật, hoặc công khai là chưa đủ dữ liệu.
- [ ] Test seller chuyển team và seller đã nghỉ.
- [ ] Test canceled/replacement/refund/partial refund.
- [ ] Test creator attribution.
- [ ] Test quyền Admin/Manager/User trên từng tool.
- [ ] Test truy vấn xuyên domain: design -> order -> fulfillment -> refund.
- [ ] Response luôn có `data_as_of`, timezone, source và quality warning.

## 10. Bộ câu hỏi nghiệm thu TikTok AI

1. Hôm nay toàn hệ thống có bao nhiêu đơn và bao nhiêu item theo giờ Los Angeles?
2. Doanh số đơn, doanh thu ước tính và tiền TikTok quyết toán tháng này khác nhau bao nhiêu?
3. Team nào có contribution profit cao nhất tuần này? Công thức đang dùng là gì?
4. Seller A có bao nhiêu store active, store nào mất auth hoặc không có đơn bất thường?
5. Đơn `[order_id]` gồm sản phẩm nào, thuộc store/team nào, đang ở xưởng nào và tracking ra sao?
6. Có bao nhiêu đơn Pending/On Hold quá SLA và tổng giá trị liên quan là bao nhiêu?
7. Vendor fulfillment nào có cost/order và refund rate cao nhất với đủ sample size?
8. Có bao nhiêu fulfillment chưa có giá và chúng ảnh hưởng team/store nào?
9. SKU nào bán nhiều nhất nhưng refund rate cao trong 30 ngày qua?
10. Store nào có chênh lệch lớn giữa estimated revenue và statement settlement?
11. Designer nào đang có backlog cao, cycle time P90 bao nhiêu và bao nhiêu task priority?
12. Design nào thiếu file bắt buộc trước khi gửi xưởng?
13. Refund tuần này phát sinh từ đơn của kỳ nào, lý do chính là gì?
14. Tại sao lợi nhuận cuối cùng chưa thể kết luận nếu ads/expense chưa đồng bộ?
15. Số liệu vừa trả lời được cập nhật đến thời điểm nào và có cảnh báo chất lượng gì?

## 11. Các việc cần xử lý trước tiên

1. Chốt từ điển metric tiền và múi giờ với người phụ trách tài chính/vận hành.
2. Tạo view/API read-only đã loại PII và token thay vì cho Agent đọc trực tiếp schema production.
3. Hoàn thiện mapping trạng thái store/seller/order/design/fulfillment.
4. Bổ sung data-quality endpoint cho missing cost, snapshot coverage và sync freshness.
5. Chốt nguồn ads, chi phí vận hành và các phí TikTok còn thiếu.
6. Sau đó mới mở các tool tổng hợp tiền cho Manager/User; tra cứu đơn và health store có thể triển khai sớm hơn theo scope.
