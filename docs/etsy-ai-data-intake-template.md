# Template thu thập và chuẩn hóa dữ liệu cho Etsy AI

> Phiên bản khảo sát schema: 17/11/2026 (Asia/Ho_Chi_Minh)
> Nguồn đã kiểm tra chỉ đọc: `165.22.58.187:/var/www/nh-media`
> Ứng dụng nguồn: `https://manager.felineez.com`
> Database nguồn: MySQL `nh_media`
> Mục tiêu: tạo hợp đồng dữ liệu đủ rõ để Etsy AI và màn Tổng quan Etsy trả lời đúng về đơn hàng, tiền, seller, team, shop, fulfillment, refund, support và sản phẩm.

## 1. Nguyên tắc bắt buộc

1. Etsy AI chỉ đọc dữ liệu qua tài khoản MySQL read-only, view hoặc API đã kiểm soát; không dùng tài khoản của ứng dụng vận hành.
2. Mọi số liệu phải kèm phạm vi ngày, múi giờ, thời điểm cập nhật và phạm vi quyền đang áp dụng.
3. Không dùng chung từ `doanh thu` cho `order total`, `net received`, `funds` và `profit`. Đây là bốn lớp tiền khác nhau.
4. Không gửi email khách hàng, địa chỉ giao hàng, token mailbox, mật khẩu, FCM token hoặc nội dung tin nhắn riêng tư vào model nếu câu hỏi không yêu cầu và không được cấp quyền.
5. Các tổng số phải được tính trong tool/backend. Model chỉ diễn giải kết quả, không tự cộng seller, shop hoặc item.
6. Không coi giá trị thiếu là `0` nếu điều đó làm sai kết luận. Phải trả thêm cảnh báo chất lượng dữ liệu.
7. Quyền dữ liệu phải đi theo cấu trúc `role -> phòng ban Etsy -> seller team/shop`, không suy ra quyền từ nội dung prompt.

## 2. Hiện trạng dữ liệu đã xác nhận

Số lượng dưới đây là ảnh chụp tại thời điểm khảo sát, không phải số cố định:

| Nhóm | Bảng/nguồn chính | Quy mô quan sát | Ghi chú |
|---|---|---:|---|
| Workspace | `Team` | 1 | Workspace đang dùng tên `Feline` |
| Seller team | `SellerTeam` | 1 | Team `Tuyen`, 15 thành viên |
| Shop/mailbox | `MailAccount` | 11 | Shop Etsy được định danh bằng mailbox và label |
| Đơn Etsy | `Record` với `kind=ORDER`, `source=Etsy_Sales` | 4.812 | Toàn bộ tiền đơn quan sát đang là USD |
| Message | `Record`, `source=Etsy_Message` | 10.488 | Không đưa nội dung vào dashboard tổng quan |
| Help | `Record`, `source=Etsy_Help` | 611 | Yêu cầu hỗ trợ từ Etsy |
| Case | `Record`, `source=Etsy_Case` | 101 | Case vận hành cần theo dõi |
| Cancel event | `Record`, `source=Etsy_Cancelled` | 269 | Dùng để cập nhật đơn gốc thành `CANCELLED` |
| Refund event | `Record`, `source=Etsy_Refund` | 158 | Số tiền cuối cùng được đồng bộ về `Record.refundAmount` của đơn |
| Funds | `Record`, `kind=FUNDS` | 173 | Tiền đang/đã chuyển, không đồng nghĩa doanh thu đơn |
| Product folder | `Product` | 1.484 | Kho sản phẩm/design nội bộ, có ảnh và category |
| Manual cost | `ManualCost` | 0 | Hiện chưa có dữ liệu thực tế |

Khoảng dữ liệu đơn Etsy quan sát được:

| Thuộc tính | Giá trị |
|---|---|
| Đơn sớm nhất | `05/09/2025 17:55:57 UTC` |
| Đơn mới nhất | `17/11/2026 02:44:54 UTC` |
| Dữ liệu cập nhật gần nhất | `17/11/2026 02:47:32 UTC` |
| Tiền tệ đơn | `USD` |

Phân bố trạng thái đơn tại thời điểm khảo sát:

| Trạng thái | Số đơn |
|---|---:|
| `NEW` | 2.362 |
| `DESIGNING` | 35 |
| `PRODUCING` | 857 |
| `SHIPPED` | 1.262 |
| `ON_HOLD` | 18 |
| `CANCELLED` | 236 |
| `REFUND` | 42 |

## 3. Màn Overview nguồn đang tính gì

Màn Overview tại `manager.felineez.com` hiện có:

- KPI: Total Orders, Profit, Revenue, Funds và Cost.
- Biểu đồ đơn và revenue theo ngày/giờ.
- Biểu đồ revenue/funds theo shop.
- Bảng xếp hạng shop đang được đặt tên là Seller Ranking.
- Daily Breakdown theo ngày.
- KPI riêng theo seller/team dựa trên tiền tố SKU.

Các điểm cần chuẩn hóa trước khi sao chép sang Feline AI:

| Hiện trạng code nguồn | Rủi ro | Quy tắc đề xuất cho Feline AI |
|---|---|---|
| Overview tổng quát có thể tính cả đơn `CANCELLED` vào Total Orders/Revenue | Tổng bán hàng có thể cao hơn thực tế | Mặc định loại `CANCELLED` khỏi sales; vẫn giữ trong biểu đồ trạng thái vận hành |
| Overview `Profit = Net - FF cost` | Chưa trừ design cost và refund | Dùng `Net - FF cost - design cost - refund`; ghi rõ chưa gồm chi phí ngoài hệ thống |
| KPI seller đã trừ FF, design và refund | Không khớp Overview tổng quát | Dùng chung một Metrics Engine cho dashboard và AI |
| Seller Ranking thực tế đang group theo shop/mailbox | Nhầm shop với nhân sự | Tách `Xếp hạng shop` và `Xếp hạng seller` thành hai bảng riêng |
| Team orders cộng từ seller có thể đếm lặp đơn nhiều seller | Sai tổng team khi một đơn có SKU của nhiều seller | Tổng team dùng `COUNT(DISTINCT order_id)`; chỉ chia tiền/item theo tỷ trọng SKU |
| Net thiếu CSV dùng ước tính phí 14,5% | Có thể bị hiểu là tiền Etsy đã xác nhận | Trả `netQuality=ESTIMATED` và số đơn đang dùng fallback |
| Timezone mặc định giao diện nguồn là `Asia/Ho_Chi_Minh` nhưng người dùng có thể đổi | Cùng câu hỏi có thể ra số khác nhau | Chốt một timezone báo cáo Etsy và luôn hiển thị trên dashboard |

## 4. Sơ đồ liên kết dữ liệu chuẩn

```text
Team.id                                      [workspace/tenant]
  -> SellerTeam.teamId
       -> User.sellerTeamId
  -> User.teamId
       -> User.sellerCodes                   [mã seller theo prefix SKU]
       -> MailAccount.linkedByUserId          [shop do seller kết nối]
  -> MailAccount.teamId
       -> Record.accountId
       -> Record.accountEmail                 [khóa shop legacy/hiển thị]
  -> Record.teamId
       -> Record.orderId                      [mã đơn Etsy]
       -> Record.details.items[].sku
       -> Record.etsyFees.sku
       -> ProductDesignLink.recordId
  -> Product.teamId
       -> ProductDesignLink.productId
  -> ManualCost.teamId
```

### Khóa nghiệp vụ cần dùng

| Đối tượng | Khóa nội bộ | Khóa nghiệp vụ/tra cứu | Quy tắc |
|---|---|---|---|
| Workspace | `Team.id` | `Team.name` | `Team` trong schema nguồn là tenant, không phải seller team |
| Seller team | `SellerTeam.id` | `SellerTeam.name` | Dùng để lọc KPI nhân sự |
| Seller | `User.id` | `sellerCodes[]` | Attribution bằng hai ký tự đầu SKU viết hoa |
| Shop | `MailAccount.id` | `email`, `label` | UI ưu tiên `label`; không gửi token mailbox |
| Đơn | `Record.id` | `Record.orderId` | Người dùng tra cứu bằng `orderId`, không dùng ID database |
| Item | `Record.id + itemIndex` | SKU/transactionId | Một đơn có nhiều item; item có thể thuộc nhiều seller |
| Product folder | `Product.id` | title/category | Không mặc định đồng nghĩa listing Etsy |
| Design link | `ProductDesignLink.designItemKey` | record + item index | Mỗi order item chỉ được liên kết một lần |

## 5. Data dictionary theo miền nghiệp vụ

### 5.1. Workspace, team và seller

Nguồn: `Team`, `SellerTeam`, `User`.

| Trường chuẩn | Nguồn | Ý nghĩa |
|---|---|---|
| `workspace_id` | `Team.id` | Tenant dữ liệu |
| `seller_team_id` | `SellerTeam.id` | Team bán hàng trong workspace |
| `seller_team_name` | `SellerTeam.name` | Tên team hiển thị |
| `seller_id` | `User.id` | Nhân sự seller |
| `seller_role` | `User.role` | OWNER/LEADER/USER/FULFILLMENT/DESIGN |
| `seller_codes` | `User.sellerCodes` | Danh sách prefix SKU thuộc seller |
| `assigned_seller_team_id` | `User.sellerTeamId` | Team mà seller đang được gán vào (nối tới `seller_team_id` ở trên) |
| `deleted_at` | `User.deletedAt` | Dùng để giữ lịch sử seller đã nghỉ |

Quy tắc attribution hiện hành:

1. Lấy SKU từ `details.items[].sku`; nếu thiếu thì dùng `etsyFees.sku`.
2. Chuẩn hóa SKU, lấy hai ký tự đầu và viết hoa.
3. Map prefix vào `User.sellerCodes`.
4. Nếu một đơn có SKU của nhiều seller, chia tiền và chi phí theo tỷ trọng số SKU.
5. Số đơn team phải đếm distinct order; không cộng trực tiếp số đơn của từng seller.
6. Trả thêm `attribution_rate`, `orders_without_sku` và `unknown_sku_prefixes`.

### 5.2. Shop Etsy

Nguồn: `MailAccount`, `User`, `SellerTeam`.

| Trường chuẩn | Nguồn | Quy tắc |
|---|---|---|
| `shop_id` | `MailAccount.id` | Khóa nội bộ |
| `shop_name` | `MailAccount.label` | Fallback về email nếu label trống |
| `shop_email` | `MailAccount.email` | Chỉ hiển thị khi role được phép |
| `provider` | `MailAccount.provider` | Gmail/Outlook |
| `linked_by_user_id` | `MailAccount.linkedByUserId` | Seller/người kết nối shop |
| `shop_seller_team_id` | qua `MailAccount.linkedByUserId` -> `User.sellerTeamId` | Team sở hữu shop, suy ra từ người kết nối mailbox |
| `platforms` | `MailAccount.platforms` | Mặc định chỉ lấy shop có Etsy |
| `last_synced_at` | `MailAccount.lastSyncedAt` | Độ tươi dữ liệu shop |
| `history_complete` | `historicalSyncComplete` | Cảnh báo nếu chưa quét đủ lịch sử |

Không được gửi `MailAccount.token`, `lastKnownHistoryId` hoặc thông tin xác thực mailbox vào tool output/model.

### 5.3. Đơn hàng và item

Nguồn: `Record` với `kind=ORDER`, `source=Etsy_Sales`.

| Trường chuẩn | Nguồn | Ý nghĩa |
|---|---|---|
| `order_id` | `Record.orderId` | Mã đơn Etsy |
| `order_date` | `Record.dtLocal` | Thời điểm bán hàng dùng cho bộ lọc kỳ |
| `order_status` | `Record.orderStatus` | NEW/DESIGNING/READY/PRODUCING/SHIPPED/ON_HOLD/CANCELLED/REFUND |
| `tracking_code` | `Record.trackingCode` | Chỉ trả khi hỏi đơn cụ thể và có quyền |
| `shop_id` | `Record.accountId` | Nối `MailAccount` |
| `shop_email` | `Record.accountEmail` | Khóa legacy/fallback |
| `currency` | `Record.currency` | Hiện dữ liệu Etsy quan sát là USD |
| `order_total` | `etsyFees.orderTotal` hoặc `details.financials.orderTotal` hoặc `amount` | Tổng tiền người mua trả |
| `item_count` | `SUM(details.items[].quantity)` | Tổng số sản phẩm, không phải số dòng item |
| `item_lines` | `details.items.length` | Số dòng item |
| `sku` | `details.items[].sku`, fallback `etsyFees.sku` | Dùng attribution seller |
| `product_name` | `details.items[].name`, fallback `Record.productName` | Dùng ranking sản phẩm |
| `variant` | `details.items[].variant` | Variant sản phẩm |
| `personalization` | `details.items[].personalization` | Dữ liệu nhạy cảm; chỉ trả theo đơn cụ thể |
| `updated_at` | `Record.updatedAt` | Độ tươi bản ghi |

Quy tắc đếm đơn:

- `sales_orders`: `COUNT(DISTINCT orderId)` và loại `CANCELLED`.
- `operational_orders`: tính mọi đơn trừ record đã soft-delete; trình bày riêng trạng thái.
- `refunded_orders`: đơn có `orderStatus=REFUND` hoặc `refundAmount > 0`.
- `shipped_orders`: `orderStatus=SHIPPED`.
- Không đếm các record `Etsy_Cancelled` hoặc `Etsy_Refund` như một đơn bán mới.

### 5.4. Tiền và lợi nhuận

Nguồn: `Record.amount`, `Record.etsyFees`, `Record.costTotal`, `Record.designCost`, `Record.refundAmount`, `ManualCost`, các record `FUNDS`.

| Metric chuẩn | Công thức/nguồn | Cách diễn giải |
|---|---|---|
| `gross_booked_value` | Tổng `order_total` của mọi sales order (loại `CANCELLED`), kể cả đơn đã refund toàn phần | Tổng tiền người mua đã trả lúc đặt; không phải tiền Etsy thực chuyển |
| `recognized_revenue` | Như `gross_booked_value` nhưng đơn refund toàn phần tính 0 (`refundAmount >= orderTotal - 0.01`, hoặc `REFUND` thiếu `refundAmount`) | Doanh thu còn lại sau refund toàn phần; khớp cách màn nguồn tính revenue |
| `etsy_net_received` | `etsyFees.estActualNet`; fallback `orderNet`; cuối cùng ước tính 85,5% order total | Tiền sau phí Etsy; luôn trả thêm chất lượng nguồn |
| `funds_amount` | Tổng record `kind=FUNDS` | Tiền trong thông báo Funds, không gộp vào doanh số |
| `fulfillment_cost` | Tổng `Record.costTotal` | Chi phí fulfillment đã ghi nhận |
| `design_cost` | Tổng `Record.designCost` | Chi phí design |
| `refund_amount` | Tổng `Record.refundAmount` | Refund đã gắn vào đơn gốc |
| `manual_cost` | Tổng `ManualCost.cost` trong kỳ | Hiện chưa có dữ liệu |
| `operational_profit` | net - fulfillment - design - refund - manual cost | Lợi nhuận vận hành trong phạm vi dữ liệu hiện có |

Quy tắc chất lượng net:

| Mức | Điều kiện | Nhãn |
|---|---|---|
| 1 | Có `etsyFees.estActualNet` | `CONFIRMED_ESTIMATED_BREAKDOWN` |
| 2 | Có `etsyFees.orderNet` | `IMPORTED_ORDER_NET` |
| 3 | Không có hai trường trên | `FALLBACK_14_5_PERCENT_FEE` |

Dashboard phải hiển thị số đơn đang dùng fallback. Không được gọi `operational_profit` là lợi nhuận kế toán cuối cùng nếu chưa có toàn bộ ads, lương, thuế và chi phí chung.

### 5.5. Fulfillment

Nguồn: các trường fulfillment nằm trực tiếp trên `Record`.

| Trường chuẩn | Nguồn | Ý nghĩa |
|---|---|---|
| `ff_code` | `Record.ffCode` | Nhà cung cấp/mã fulfillment |
| `ff_cost` | `Record.costTotal` | Chi phí fulfillment |
| `ff_note` | `Record.ffNote` | Ghi chú nội bộ; không đưa vào báo cáo tổng quan |
| `order_status` | `Record.orderStatus` | Pipeline sản xuất |
| `tracking_code` | `Record.trackingCode` | Tracking đầu ra |
| `shipped_at` | `etsyFees.dateShipped` nếu có | Ngày ship từ dữ liệu Etsy CSV |

KPI tối thiểu:

- Đơn NEW, DESIGNING, PRODUCING, SHIPPED, ON_HOLD.
- Tỷ lệ shipped trên operational orders.
- Backlog chưa shipped theo tuổi đơn.
- Đơn thiếu FF cost.
- Đơn shipped thiếu tracking.
- Chi phí fulfillment theo shop, seller và FF code.

### 5.6. Refund, cancellation và support

Nguồn: `Record.refundAmount`, `orderStatus`, các source `Etsy_Refund`, `Etsy_Cancelled`, `Etsy_Case`, `Etsy_Help`, `Etsy_Message`.

| Metric | Quy tắc |
|---|---|
| `refund_orders` | Distinct đơn gốc có `refundAmount > 0` hoặc `orderStatus=REFUND` |
| `refund_amount` | Tổng refund trên đơn gốc; không cộng lại event refund |
| `cancelled_orders` | Distinct đơn gốc có `orderStatus=CANCELLED` |
| `open_cases` | Case trong kỳ; cần chốt field/trạng thái đóng nếu muốn tính backlog case |
| `help_requests` | Record nguồn `Etsy_Help` trong kỳ |
| `message_volume` | Chỉ dùng volume; nội dung message không đưa vào dashboard |

### 5.7. Product và design link

Nguồn: `Product`, `Category`, `ProductDesignLink`, `Record.details.items`.

| Nhóm | Trường/metric |
|---|---|
| Product folder | title, category, price, currency, images, status, creator |
| Item bán | name, SKU, variant, quantity, price, image |
| Design link | product folder, order item, người link, thời điểm link |
| KPI | top product theo item, revenue, net; tỷ lệ order item đã có design link |

Không mặc định `Product` là listing Etsy. Đây là kho sản phẩm/design nội bộ và cần báo cáo riêng với item bán thực tế.

## 6. Phạm vi quyền đề xuất

| Role Feline AI | Phạm vi Etsy mặc định |
|---|---|
| Admin | Toàn workspace, toàn seller team và shop; xem finance/audit |
| Manager phòng Etsy | Các seller team/shop được cấp; xem finance nếu grant cho phép |
| User | Shop do mình phụ trách hoặc danh sách shop được cấp; không xem finance tổng nếu không có grant |

Data scope đề xuất:

- `etsy.operations.basic`: orders, items, trạng thái, shop trong phạm vi.
- `etsy.finance`: revenue, net, funds, cost, refund và profit.
- `etsy.team.performance`: team/seller KPI và attribution quality.
- `etsy.shops`: tình trạng sync và hiệu suất shop.
- `etsy.fulfillment`: backlog, FF cost, tracking và pipeline.
- `etsy.support`: case/help/message volume; nội dung cần scope riêng.
- `etsy.products`: product folder, item và design-link coverage.

## 7. Kết nối read-only cần cấp

Do MySQL hiện chỉ nghe tại `127.0.0.1:3306`, cần chọn một trong hai cách:

1. **Khuyến nghị:** tạo MySQL user chỉ đọc, giới hạn IP/Tailscale của máy chạy Feline AI và chỉ mở qua private network.
2. Dùng SSH tunnel cố định từ máy Feline AI tới `165.22.58.187`, sau đó kết nối MySQL qua local tunnel.
3. Xây endpoint export read-only có ký request; chỉ dùng khi không thể mở private DB connection.

Biến môi trường dự kiến trên Feline AI:

```env
ETSY_DB_HOST=
ETSY_DB_PORT=3306
ETSY_DB_NAME=nh_media
ETSY_DB_USER=feline_etsy_readonly
ETSY_DB_PASSWORD=
ETSY_DB_SSL=false
ETSY_DB_CONNECT_TIMEOUT_MS=10000
ETSY_DB_QUERY_TIMEOUT_MS=15000
```

Quyền database tối thiểu:

`<db-client-host>` phụ thuộc cách kết nối:

| Cách kết nối | `ETSY_DB_HOST` trên Feline AI | `<db-client-host>` trong `GRANT` |
|---|---|---|
| Trực tiếp qua private network/Tailscale | IP hoặc DNS private của máy chủ MySQL | IP private của máy Feline AI |
| SSH tunnel cố định | `127.0.0.1` (cổng local của tunnel) | `localhost` hoặc `127.0.0.1`, vì MySQL thấy kết nối đến từ chính máy chủ |

```sql
GRANT SELECT ON nh_media.`Team` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`SellerTeam` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`User` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`MailAccount` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`Record` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`ManualCost` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`Product` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`Category` TO 'feline_etsy_readonly'@'<db-client-host>';
GRANT SELECT ON nh_media.`ProductDesignLink` TO 'feline_etsy_readonly'@'<db-client-host>';
```

Không cấp `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `ALTER`, `DROP`, `EXECUTE`, `FILE` hoặc quyền đọc bảng chứa secret không cần thiết.

## 8. Tool nền đề xuất cho Etsy AI

| Tool | Nhiệm vụ | Output chính |
|---|---|---|
| `etsy.overview.get` | Tổng quan theo kỳ và phạm vi quyền | orders, items, gross, net, costs, refund, profit, statuses, quality |
| `etsy.orders.search` | Tra cứu bằng order ID/tracking/SKU | thông tin đơn đã lọc PII |
| `etsy.money.summary` | Phân tích lớp tiền | gross, net, funds, FF/design/refund/manual cost, profit |
| `etsy.team.performance` | KPI team và seller | orders distinct, items, attribution, money, ranking |
| `etsy.shops.performance` | Hiệu suất và độ tươi shop | orders, money, sync freshness, history completeness |
| `etsy.fulfillment.metrics` | Pipeline và backlog | status, age band, missing cost/tracking, FF code |
| `etsy.support.metrics` | Case/help/message volume | counts và xu hướng, không lộ nội dung riêng tư |
| `etsy.products.metrics` | Sản phẩm và design-link | top products, SKU, item, link coverage |

## 9. Hợp đồng dữ liệu màn Tổng quan Etsy

Endpoint đề xuất:

```http
GET /etsy/dashboard?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&sellerTeamId=all&shopId=all&sellerId=all
```

Response tối thiểu:

```json
{
  "range": {
    "startDate": "2026-11-11",
    "endDate": "2026-11-17",
    "timeZone": "Asia/Ho_Chi_Minh"
  },
  "filters": {
    "sellerTeamId": "all",
    "shopId": "all",
    "sellerId": "all"
  },
  "summary": {
    "orders": 0,
    "items": 0,
    "grossBookedValue": 0,
    "recognizedRevenue": 0,
    "etsyNetReceived": 0,
    "fundsAmount": 0,
    "fulfillmentCost": 0,
    "designCost": 0,
    "refundAmount": 0,
    "manualCost": 0,
    "operationalProfit": 0,
    "shops": 0,
    "activeSellers": 0
  },
  "statuses": {
    "new": 0,
    "designing": 0,
    "producing": 0,
    "shipped": 0,
    "onHold": 0,
    "cancelled": 0,
    "refund": 0
  },
  "trend": [
    {
      "reportDate": "2026-11-17",
      "orders": 0,
      "items": 0,
      "grossBookedValue": 0,
      "recognizedRevenue": 0,
      "etsyNetReceived": 0,
      "operationalProfit": 0
    }
  ],
  "sellerTeams": [],
  "shops": [],
  "sellers": [],
  "topProducts": [],
  "quality": {
    "ordersUsingNetFallback": 0,
    "ordersWithoutSku": 0,
    "ordersWithUnknownSellerPrefix": 0,
    "ordersMissingFulfillmentCost": 0,
    "shippedOrdersMissingTracking": 0,
    "warnings": []
  },
  "source": {
    "id": "feline-etsy",
    "access": "read-only",
    "dataUpdatedAtUtc": "2026-11-17T02:47:32.148Z",
    "generatedAtUtc": "2026-11-17T03:00:00.000Z"
  }
}
```

## 10. Bố cục màn Tổng quan Etsy trong Feline AI

Màn mới kế thừa logic lọc và realtime của TikTok Dashboard nhưng không sao chép máy móc metric TikTok.

### Khu vực điều khiển

- Chọn kỳ: Hôm nay, Hôm qua, 7 ngày, Tháng này, Tháng trước, Tùy chọn.
- Lọc seller team, shop và seller theo quyền.
- Nút `Phân tích dữ liệu mới` và thời điểm cập nhật gần nhất.
- Hiển thị rõ timezone báo cáo.

### KPI chính

1. **Lợi nhuận vận hành** — net trừ FF, design, refund và manual cost.
2. **Net sau phí Etsy** — kèm tỷ lệ số đơn dùng dữ liệu xác nhận/fallback.
3. **Đơn và sản phẩm** — sales order distinct, item quantity.

### KPI hỗ trợ

- Gross booked value và Recognized revenue (hiển thị cạnh nhau để thấy phần đã refund toàn phần).
- Fulfillment cost.
- Design cost.
- Refund amount và số đơn refund.
- Funds amount.
- Shop có dữ liệu và seller có attribution.

### Biểu đồ

- Biểu đồ cột nhịp đơn theo ngày, có thể đổi sang Net/Profit.
- Biểu đồ cột ngang trạng thái đơn.
- So sánh Recognized revenue, Net, Cost và Profit theo shop.
- Không dùng quá nhiều màu; gross burgundy, net leaf, cost ochre, refund danger.

### Bảng

- Xếp hạng seller theo profit hoặc net, có orders/items/attribution.
- Xếp hạng shop tách riêng seller.
- Drill-down chất lượng dữ liệu: SKU chưa gán, net fallback, thiếu cost/tracking.
- Top sản phẩm là tab/khối phụ, không đẩy bảng seller xuống quá xa.

## 11. Quyết định cần chốt trước production

Cột "Hiện trạng" được đối chiếu với code nguồn (`src/utils/kpiProcessing.ts`, `src/utils/dataProcessing.ts`, `api/_lib/teamScope.ts`) ngày 17/11/2026. Cột "Đề xuất" là mặc định cho Feline AI; các mục đánh dấu **Cần quyết** là quyết định kinh doanh, code không trả lời được.

| # | Câu hỏi | Hiện trạng | Đề xuất cho Feline AI | Trạng thái |
|---:|---|---|---|---|
| 1 | Timezone báo cáo | Giao diện nguồn mặc định `Asia/Ho_Chi_Minh`, người dùng đổi được; ngày đơn tính theo timezone đang chọn | Chốt một timezone báo cáo Etsy (mặc định `Asia/Ho_Chi_Minh`), luôn hiển thị trên dashboard và trong câu trả lời AI | **Cần quyết** |
| 2 | Total Orders có loại `CANCELLED` không | KPI seller/team loại `CANCELLED`; Overview tổng quát có thể vẫn đếm | Loại `CANCELLED` khỏi sales; vẫn hiển thị riêng trong biểu đồ trạng thái | Đề xuất |
| 3 | Đơn `REFUND` toàn phần | Đơn vẫn được đếm; revenue và net bằng 0 (`isFullRefundOrder`: `refundAmount >= orderTotal - 0.01`, hoặc thiếu `refundAmount`) | Giữ nguyên: đếm đơn, revenue/net bằng 0, không trừ refund lần hai | Khớp code |
| 4 | Refund một phần tính theo ngày nào | Refund gắn vào đơn gốc nên rơi vào ngày của đơn, không phải ngày refund phát sinh | Giữ theo ngày đơn; hiển thị ghi chú trên dashboard | Khớp code, **Cần quyết** nếu muốn theo ngày refund |
| 5 | Funds theo ngày nào | Record `FUNDS` được gom theo ngày của chính record (email Funds), không đối soát vào kỳ đơn | Giữ theo ngày email Funds; không cộng vào doanh số | Khớp code |
| 6 | `estActualNet` là nguồn chính thức? | Là nguồn net ưu tiên số 1 (xấp xỉ "You earned" của Etsy) nhưng vẫn là ước tính | Gọi là "net ước tính từ dữ liệu Etsy", kèm `netQuality` | **Cần quyết** cách gọi |
| 7 | Thiếu `etsyFees` có dùng fallback 14,5% không | Có (`ETSY_FALLBACK_FEE_RATE = 0.145`) | Giữ nhưng luôn trả `ordersUsingNetFallback` | Khớp code |
| 8 | Profit gồm design, refund, manual cost? | KPI seller trừ FF, design và refund; Overview tổng quát chỉ `Net - FF`; manual cost chưa vào KPI seller | `net - FF - design - refund - manual cost`, một Metrics Engine dùng chung | Đề xuất |
| 9 | Chi phí ads/lương/thuế khác | Hệ thống chưa lưu; `ManualCost` hiện 0 bản ghi | Không gọi là lợi nhuận cuối cùng; gọi là "lợi nhuận vận hành" | **Cần quyết** có nhập thêm chi phí không |
| 10 | Đơn nhiều seller chia theo gì | Chia theo số SKU: `share = số SKU của seller / tổng SKU`, áp cho revenue, net, FF, design, refund; order đếm distinct | Giữ theo số SKU để khớp số hiện tại; theo giá trị item cần dữ liệu giá từng item | **Cần quyết** |
| 11 | Seller đã nghỉ trong báo cáo lịch sử | `User.deletedAt` (xóa mềm) giữ lịch sử; `sellerCodes` còn nguyên | Giữ trong báo cáo lịch sử, gắn nhãn "đã nghỉ"; ẩn khỏi bộ lọc mặc định | Đề xuất |
| 12 | Shop thuộc team nào | Qua `MailAccount.linkedByUserId` -> `User.sellerTeamId`; chưa có bảng sở hữu riêng | Dùng người kết nối mailbox; nếu một shop đổi chủ thì cần bảng sở hữu có hiệu lực theo ngày | **Cần quyết** |
| 13 | Phạm vi của Leader | Leader xem shop do chính mình và mọi thành viên cùng `sellerTeamId` kết nối, cộng `allowedAccounts` (`visibleAccountEmails`) | Giữ đúng quy tắc này ở backend | Khớp code |
| 14 | AI có tìm nội dung case/help/message | Hệ thống nguồn chưa có quy tắc cho AI | Chỉ đếm số lượng; nội dung cần scope `etsy.support` riêng và lọc PII | **Cần quyết** |
| 15 | Top product tính theo gì | Chưa có quy tắc chung | Mặc định số lượng item; cho phép đổi sang gross, net, profit | **Cần quyết** |

Tóm tắt: 5 mục khớp với code (3, 4, 5, 7, 13), 3 mục đề xuất mặc định (2, 8, 11) và 7 mục cần chủ hệ thống quyết (1, 6, 9, 10, 12, 14, 15). Mục 4 chỉ cần quyết lại nếu muốn tính refund theo ngày phát sinh.

## 12. Câu hỏi nghiệm thu dữ liệu

1. Hôm nay phòng Etsy có bao nhiêu đơn và bao nhiêu sản phẩm?
2. Gross booked value, recognized revenue và net sau phí Etsy hôm nay là bao nhiêu?
3. Lợi nhuận vận hành 7 ngày gần nhất là bao nhiêu và đang thiếu chi phí nào?
4. Team Tuyen có bao nhiêu đơn trong tháng này?
5. Seller nào có net cao nhất 7 ngày qua?
6. Shop nào có nhiều đơn nhất hôm nay?
7. Có bao nhiêu đơn NEW, DESIGNING, PRODUCING và SHIPPED?
8. Có bao nhiêu đơn đang ON_HOLD?
9. Có bao nhiêu đơn shipped nhưng chưa có tracking?
10. Có bao nhiêu đơn chưa có fulfillment cost?
11. Tổng refund và số đơn refund trong tháng này là bao nhiêu?
12. Có bao nhiêu đơn đang dùng net fallback 14,5%?
13. Tỷ lệ attribution seller hiện là bao nhiêu?
14. Các prefix SKU nào chưa được gán seller?
15. Sản phẩm nào bán nhiều nhất trong 30 ngày gần đây?

## 13. Tiêu chí hoàn thành giai đoạn dữ liệu Etsy

- Kết nối chỉ đọc và từ chối mọi câu lệnh ghi.
- Dashboard và Etsy AI dùng chung Metrics Engine.
- Tổng orders theo team không bị cộng lặp từ seller rows.
- Mỗi metric tiền có tên và công thức riêng.
- Dashboard hiển thị timezone, độ tươi và cảnh báo chất lượng.
- Phân quyền được kiểm tra ở backend, không chỉ ẩn bằng frontend.
- 15 câu hỏi nghiệm thu trả đúng với truy vấn kiểm chứng trực tiếp.
- Mọi request, tool call, lỗi, thời gian phản hồi và phạm vi quyền đều được audit.
