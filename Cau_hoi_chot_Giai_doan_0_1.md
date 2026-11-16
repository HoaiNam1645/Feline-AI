# Câu hỏi chốt Giai đoạn 0 và 1

*Dự án: Multi-Agent AI vận hành doanh nghiệp*  
*Ngày lập: 29/10/2026*  
*Tham chiếu: `Tai_lieu_thiet_ke_Multi_Agent_AI_v2.pdf` và `Giai_doan_0_Quyet_dinh.md`*

## Cách trả lời

- Trả lời theo mã câu hỏi, ví dụ: `0.3: Thời điểm thanh toán thành công`.
- Có thể chọn phương án đề xuất hoặc ghi phương án khác.
- Câu có nhãn **BẮT BUỘC** phải được trả lời trước khi bắt đầu lập trình Giai đoạn 1A.
- Không hỏi lại các quyết định đã chốt: Agent báo cáo vận hành xưởng R0, Telegram, gửi lúc 8h sáng giờ Việt Nam, Windows + WSL2, BullMQ + Redis, Prisma và hard cap Claude 100 USD/tháng.

---

## Kết quả khảo sát nguồn dữ liệu

Đã kết nối read-only, không đọc nội dung PII và không thay đổi dữ liệu.

| Server | Database/dự án | Kết quả |
|---|---|---|
| `165.22.58.187` | MySQL 8.0.46, `feline` | Nguồn bán hàng hiện tại: 74.669 đơn; dữ liệu đơn đến 28/10/2026, chi tiết và refund cập nhật đến 29/10/2026. |
| `167.99.13.198` | `/var/www/shop-test/manage-lemiex`, MySQL `lemiex-test` | Hệ thống xưởng Lemiex hiện tại: 15.757 đơn, 17.752 item và 17.748 production; cập nhật đến 29/10/2026. |
| `167.99.13.198` | `fulfillment_felineez` | 14.374 đơn, dữ liệu mới nhất đến 24/07/2026; có vẻ là nguồn cũ. |
| `167.99.13.198` | `lemiex-fulfillment` | 9.116 đơn, dữ liệu mới nhất đến 18/08/2026; là nguồn fulfillment cũ. |
| `165.22.58.187` | `lemiex_test` | 1.044 đơn; không phải hệ thống xưởng Lemiex chính. |
| `165.22.58.187` | PostgreSQL `ecommerce_intelligence` | Có schema đơn hàng nhưng hiện chưa có dữ liệu; không dùng cho KPI Giai đoạn 1. |

Hai MySQL server đang dùng UTC. Báo cáo ngày theo giờ Việt Nam phải truy vấn khoảng UTC từ 17:00 ngày hôm trước đến 17:00 ngày báo cáo.

Nguồn dữ liệu cho MVP đã xác định:

- [x] Giai đoạn 0–1 chỉ dùng `lemiex-test` của project `shop-test` trên `167.99.13.198`.
- [x] Agent đầu tiên là Agent báo cáo vận hành xưởng hằng ngày, mức R0.
- [x] Chưa kết nối `feline` trong MVP để tránh ghép dữ liệu giữa hai server.
- [x] `feline` sẽ là nguồn mở rộng sau khi Giai đoạn 1 chạy ổn định.

Hai database đều chứa cột PII. Hệ thống AI phải dùng tài khoản hoặc database view chỉ đọc đã loại tên, email, số điện thoại và địa chỉ.

---

# A. Câu hỏi chốt Giai đoạn 0

## 0.1. Cách kết nối database **BẮT BUỘC**

Hệ thống AI sẽ kết nối database `lemiex-test` theo cách nào?

- [ ] Database view chỉ đọc, chỉ chứa cột cần thiết và đã loại PII (đề xuất).
- [ ] Tài khoản chỉ đọc trực tiếp trên các bảng production.
- [ ] Đồng bộ định kỳ sang database báo cáo riêng.
- [ ] Khác: __________

Có cho phép tạo user MySQL riêng cho hệ thống AI trên server `167.99.13.198` không?

- [ ] Có.
- [ ] Không, dùng user hiện có.

**Trả lời:**

## 0.2. Schema và dữ liệu kiểm thử **BẮT BUỘC**

Có đồng ý dùng các bảng sau làm nguồn ban đầu không?

**Nguồn MVP `lemiex-test`:**

- `orders`, `order_items`, `productions`
- `order_item_workflows`, `order_item_remakes`
- `tracking`, `stores`

- [ ] Đồng ý.
- [ ] Cần thêm/bỏ bảng: __________

Số đơn ẩn danh dùng làm test fixture:

- [ ] 20–50 đơn (đề xuất tối thiểu).
- [ ] Trên 50 đơn.
- [ ] Không xuất dữ liệu mẫu; kiểm thử trực tiếp qua view chỉ đọc.

**Trả lời:**

## 0.3. Mốc ghi nhận đơn **BẮT BUỘC**

Một đơn được tính vào ngày báo cáo theo thời điểm nào?

- [ ] Thời điểm thanh toán thành công (đề xuất).
- [ ] Thời điểm tạo đơn.
- [ ] Thời điểm sàn xác nhận đơn.
- [ ] Thời điểm bắt đầu sản xuất.
- [ ] Khác: __________

Nếu đơn được cập nhật sau 8h sáng, hệ thống phải:

- [ ] Cập nhật số liệu và gửi lại nếu thay đổi vượt ngưỡng.
- [ ] Chỉ cập nhật trong database/dashboard.
- [ ] Ghi nhận vào báo cáo ngày tiếp theo.

**Trả lời:**

## 0.4. Công thức đơn hàng và khối lượng công việc **BẮT BUỘC**

- Đơn mới tính theo `orders.created_at` hay thời điểm khác? __________
- Có loại `test_order` và bản ghi `deleted_at` không? __________
- Đơn hủy trong ngày có được tính vào tổng đơn mới không? __________
- Chỉ số khối lượng chính là số đơn, số item hay tổng `quantity`? __________
- Đơn remake được tính riêng hay cộng vào khối lượng sản xuất? __________

**Công thức số đơn/item cuối cùng:**

## 0.5. Chi phí và tiền tệ **BẮT BUỘC**

Đơn vị báo cáo chính:

- [ ] USD.
- [ ] VND.
- [ ] Hiển thị song song USD và VND.

Các trường `total_cost`, `paid_cost`, `print_cost`, `embroidery_fee`, `extra_fee`, `refund_fee` và `priority_fee` đang dùng đơn vị nào? __________

Nếu có nhiều tiền tệ, tỷ giá lấy từ đâu?

- [ ] Tỷ giá đã lưu trong đơn/giao dịch (đề xuất nếu có).
- [ ] Tỷ giá ngân hàng/API tại ngày thanh toán.
- [ ] Tỷ giá cố định do doanh nghiệp cấu hình.
- [ ] Khác: __________

**Trả lời:**

## 0.6. Công thức chi phí fulfillment **BẮT BUỘC**

Chọn các khoản cần hiển thị:

- [ ] Tổng chi phí đơn (`total_cost`).
- [ ] Chi phí đã thanh toán (`paid_cost`).
- [ ] Chi phí in (`print_cost`).
- [ ] Phí thêu (`embroidery_fee`).
- [ ] Phí bổ sung (`extra_fee`).
- [ ] Phí refund (`refund_fee`).
- [ ] Phí ưu tiên (`priority_fee`).
- [ ] Shipping cost.
- [ ] Phí remake/làm lại.
- [ ] Khác: __________

Khi thiếu một khoản chi phí:

- [ ] Không hiển thị tổng chi phí và đánh dấu thiếu dữ liệu (đề xuất).
- [ ] Tạm tính khoản thiếu bằng 0 và cảnh báo.
- [ ] Dùng giá trị ước tính đã cấu hình.

**Công thức chi phí fulfillment cuối cùng:**

## 0.7. Nhóm sản phẩm và phương pháp trang trí **BẮT BUỘC**

Báo cáo khối lượng sản xuất theo:

- [ ] SKU.
- [ ] Mẫu thêu/design.
- [ ] Dòng sản phẩm.
- [ ] Cả SKU và mẫu thêu.
- [ ] Khác: __________

Nguồn ánh xạ SKU sang mẫu thêu/dòng sản phẩm: __________

## 0.8. Fulfillment và đơn trễ **BẮT BUỘC**

| Nhóm báo cáo | Trạng thái trong `lemiex-test` |
|---|---|
| Chờ xử lý | |
| Chờ thêu | |
| Đang sản xuất | |
| QC | |
| Chờ đóng gói | |
| Đã giao vận | |
| Lỗi/cần xử lý | |
| Hủy | |

SLA đơn trễ:

- Mốc bắt đầu tính: __________
- Số giờ/ngày tiêu chuẩn: __________
- Có loại trừ Chủ nhật/ngày nghỉ không? __________
- Đơn ưu tiên có SLA riêng không? __________

## 0.9. Mở rộng dữ liệu sau MVP

Giai đoạn 0–1 chưa ghép `feline`. Khi mở rộng, khóa dự kiến:

- [x] `feline.orders.so_code = lemiex-test.orders.ref_id` — hiện khớp 12.941 đơn.
- [ ] Có khóa khác cần ưu tiên: __________

Khi mở rộng, nếu đơn bán hàng không ghép được với đơn xưởng:

- [ ] Vẫn tính doanh thu, đánh dấu chưa có chi phí/fulfillment (đề xuất).
- [ ] Loại khỏi báo cáo lợi nhuận.
- [ ] Dùng chi phí ước tính.
- [ ] Khác: __________

Nếu đơn xưởng không ghép được với đơn bán hàng:

- [ ] Đưa vào mục “Đơn xưởng không rõ nguồn” (đề xuất).
- [ ] Bỏ qua.
- [ ] Khác: __________

## 0.10. Độ đầy đủ và độ tươi dữ liệu **BẮT BUỘC**

Điều kiện xác nhận một nguồn đã đồng bộ đủ:

- [ ] Có watermark hoặc trạng thái sync trong database.
- [ ] Dựa vào thời gian cập nhật gần nhất.
- [ ] Đối chiếu số lượng đơn với dashboard nguồn.
- [ ] Kết hợp các cách trên (đề xuất).

Thời điểm muộn nhất dữ liệu phải hoàn tất để gửi báo cáo 8h: __________

Cho phép dữ liệu trễ tối đa bao lâu trước khi cảnh báo? __________

## 0.11. Bảo mật dữ liệu **BẮT BUỘC**

Các trường bị cấm đưa sang hệ thống AI, Claude, log và Telegram:

- [ ] Tên khách hàng.
- [ ] Email.
- [ ] Số điện thoại.
- [ ] Địa chỉ.
- [ ] Nội dung tin nhắn/ghi chú của khách.
- [ ] Shipping label và URL chứa thông tin khách hàng.
- [ ] Khác: __________

Có đồng ý tạo view chỉ chứa dữ liệu được phép không?

- [ ] Có (đề xuất).
- [ ] Không.

## 0.12. Môi trường phát triển và triển khai **BẮT BUỘC**

- [x] Windows 11 Pro, version 10.0.22631, build 22631.
- [x] Intel Core i3-10105F, 4 nhân/8 luồng.
- [x] RAM 15,9 GB.
- [x] Ổ C: 222,2 GB, còn 96,9 GB.
- [x] Ổ D: 931,5 GB, còn 720,8 GB.
- [x] OpenSSH Server chạy tự động.
- [x] Khi dùng nguồn AC, máy không tự sleep và không tự hibernate.
- [x] Đã bật Windows Subsystem for Linux ngày 29/10/2026.
- [x] Đã bật Virtual Machine Platform ngày 29/10/2026.
- [x] Đã reboot Windows và cài WSL package 3.0.3; `WslService` chạy tự động.
- [x] Đã cài Ubuntu 24.04 cho WSL2.
- [x] Đã cài Docker Engine trong WSL2; service tự bật và `hello-world` chạy thành công.
- [x] Đã đặt WSL virtual disk tại `D:\WSL\Ubuntu-24.04\ext4.vhdx`.
- [x] Đã đặt mã nguồn tại `/home/thao/Feline-AI` trong filesystem Linux của WSL2.
- [x] Đã cài Git, Node.js 22, npm, pnpm và Claude Code trong WSL2.
- [ ] Chạy được Docker Compose cho PostgreSQL, Redis, backend và worker trên môi trường phát triển.

Vai trò của máy `192.168.1.99`:

- [x] Máy phát triển để cài môi trường và code dự án.
- [x] Đồng thời là máy staging chạy thử liên tục.
- [x] Đồng thời là máy production chạy 24/7.
- [ ] Production sẽ triển khai trên máy khác: __________

Trước 14 ngày nghiệm thu 1A cần hoàn thành:

- [ ] Cơ chế tự khởi động sau reboot.
- [ ] Backup ngoài máy và thử khôi phục.
- [ ] Giám sát và cảnh báo mất kết nối.
- UPS: Có / Không
- Vị trí backup NAS: __________

Có bắt buộc thử khôi phục backup trước nghiệm thu 1A không?

- [ ] Có (đề xuất).
- [ ] Không, chỉ kiểm tra file backup tồn tại.

Có thêm một bản backup mã hóa ngoài địa điểm ngay trong 1A không?

- [ ] Có (đề xuất).
- [ ] Để sau Giai đoạn 1.

## 0.13. Số liệu nền đo hiệu quả

- Tổng hợp đơn mới và khối lượng item: __________ phút/ngày.
- Tổng hợp tình trạng sản xuất: __________ phút/ngày.
- Kiểm tra tồn đọng và đơn trễ: __________ phút/ngày.
- Kiểm tra đơn lỗi/hoàn/hủy: __________ phút/ngày.
- Tổng hợp chi phí fulfillment: __________ phút/ngày.
- Tổng cộng: __________ phút/ngày.
- Người đang thực hiện: __________

## 0.14. Điều kiện đóng Giai đoạn 0 **BẮT BUỘC**

- [ ] Có schema và dữ liệu mẫu/view kiểm thử.
- [ ] Công thức KPI đã được xác nhận.
- [ ] User DB read-only kết nối thành công từ máy chạy AI.
- [ ] Mẫu báo cáo đã được duyệt.
- [ ] Agent Spec, Metric Spec, task state machine và ERD đã duyệt.
- [ ] Telegram bot/chat ID và Claude API key sẵn sàng.
- [ ] WSL2, Docker Engine và nơi backup sẵn sàng.

**Người xác nhận đóng Giai đoạn 0:** __________  
**Ngày xác nhận:** __________

---

# B. Câu hỏi chốt Giai đoạn 1

## 1.1. Phạm vi Giai đoạn 1A **BẮT BUỘC**

- [ ] Báo cáo Telegram và trang quản trị run tối giản (đề xuất).
- [ ] Chỉ báo cáo Telegram, chưa làm Dashboard.
- [ ] Báo cáo Telegram và Dashboard đầy đủ như tài liệu gốc.

Hỏi đáp tự do qua Telegram:

- [ ] Không nằm trong 1A; chỉ làm ở 1B sau khi 1A nghiệm thu (đề xuất).
- [ ] Làm ngay trong 1A.

**Trả lời:**

## 1.2. Mẫu báo cáo **BẮT BUỘC**

Thứ tự đề xuất:

1. Tình trạng dữ liệu `shop-test`.
2. Tổng quan đơn mới, item và quantity.
3. Khối lượng theo phương pháp thêu/in và loại sản phẩm.
4. Trạng thái sản xuất.
5. Tồn đọng và đơn trễ SLA.
6. Đơn đã ship/closed trong ngày.
7. Đơn hủy/refund, remake/lỗi và chi phí liên quan.
8. Tổng hợp chi phí fulfillment.
9. Nhận xét của AI.

Chi phí fulfillment có gửi vào group quản lý không?

- [ ] Có, nằm trong phần tổng quan.
- [ ] Có, nhưng thành phần riêng.
- [ ] Chưa hiển thị trong 1A.

Số dòng chi tiết tối đa trên Telegram: __________

**Mẫu báo cáo được duyệt tại:** __________

## 1.3. Vai trò của Claude **BẮT BUỘC**

- [ ] Code/template dựng toàn bộ số liệu; Sonnet chỉ viết nhận xét (đề xuất).
- [ ] Haiku định dạng số liệu; Sonnet viết nhận xét.
- [ ] Chỉ dùng Haiku cho toàn bộ báo cáo.
- [ ] Khác: __________

AI có được đưa ra con số không tồn tại trong JSON metric đầu vào không?

- [ ] Không bao giờ (đề xuất).
- [ ] Có, nếu ghi rõ là ước tính.

Khi không đủ dữ liệu để kết luận nguyên nhân:

- [ ] Chỉ nêu hiện tượng và câu hỏi cần điều tra (đề xuất).
- [ ] Nêu các nguyên nhân có thể xảy ra.
- [ ] Không hiển thị phần phân tích.

## 1.4. Dữ liệu thiếu hoặc đến muộn **BẮT BUỘC**

Nếu một nguồn chưa đồng bộ xong lúc 8h:

- [ ] Vẫn gửi, đánh dấu nguồn thiếu và không đưa vào tổng hợp (đề xuất).
- [ ] Dùng dữ liệu gần nhất của nguồn đó.
- [ ] Hoãn gửi đến khi đủ dữ liệu.

Khi dữ liệu đến đủ:

- [ ] Gửi bản cập nhật nếu số đơn/item hoặc trạng thái tồn đọng thay đổi vượt ngưỡng.
- [ ] Chỉ cập nhật database/dashboard.
- [ ] Luôn gửi lại báo cáo.

Ngưỡng thay đổi để gửi lại: __________

## 1.5. Lịch chạy, retry và chống gửi trùng **BẮT BUỘC**

Lịch đề xuất:

- 06:00: đọc nguồn và tính KPI.
- 07:30: tạo báo cáo.
- 08:00: gửi Telegram.

Retry khi job lỗi:

- [ ] Ba lần: sau 5, 15 và 30 phút (đề xuất).
- [ ] Khác: __________

Khi Telegram timeout:

- [ ] Retry với delivery ID/idempotency key để tránh gửi trùng (đề xuất).
- [ ] Không retry, chỉ báo quản trị.

## 1.6. Lưu trữ và truy vết **BẮT BUỘC**

Mỗi báo cáo lưu:

- [ ] KPI snapshot/JSON đầu vào.
- [ ] Phiên bản Metric Spec và câu SQL.
- [ ] Prompt và model version.
- [ ] Nội dung báo cáo cuối.
- [ ] Token và chi phí.
- [ ] Telegram message ID/trạng thái gửi.
- [ ] Lỗi và lịch sử retry.

Thời gian giữ KPI snapshot:

- [ ] 12 tháng.
- [ ] 24 tháng (đề xuất để so sánh theo năm).
- [ ] Không xóa.
- [ ] Khác: __________

## 1.7. Dashboard và xác thực

Người được truy cập trang quản trị:

- [ ] Chỉ chủ doanh nghiệp (đề xuất ban đầu).
- [ ] Tất cả thành viên group quản lý.
- [ ] Danh sách riêng: __________

Phương án xác thực:

- [ ] Tailscale + tài khoản/mật khẩu được hash trong hệ thống.
- [ ] Tailscale + SSO.
- [ ] Chỉ Tailscale, không đăng nhập riêng.

Có khóa tạm thời sau nhiều lần đăng nhập sai không? __________

## 1.8. Bảo mật Telegram **BẮT BUỘC**

Bot kiểm tra:

- [ ] Chỉ `chat_id` của group.
- [ ] Cả `chat_id` và allowlist `user_id` (đề xuất).

Ai được phép thêm/xóa thành viên group? __________

Có chấp nhận rằng người đã rời group vẫn có thể giữ nội dung báo cáo cũ không?

- [ ] Có.
- [ ] Không; cần đổi kênh gửi dữ liệu tài chính.

## 1.9. Ngân sách mỗi lần chạy **BẮT BUỘC**

- Chi phí tối đa cho một báo cáo: __________ USD.
- Token đầu vào tối đa: __________
- Token đầu ra tối đa: __________
- Timeout một lần gọi model: __________ giây.
- Số lần retry Claude API: __________

Khi vượt giới hạn:

- [ ] Gửi báo cáo số liệu không có nhận xét AI (đề xuất).
- [ ] Không gửi báo cáo.
- [ ] Chuyển sang model rẻ hơn.

## 1.10. Nghiệm thu Giai đoạn 1A **BẮT BUỘC**

- [ ] KPI khớp 100% với đối chiếu thủ công trong 7 ngày liên tiếp.
- [ ] Chạy tự động thêm 7 ngày, không bỏ sót hoặc gửi trùng báo cáo.
- [ ] Báo cáo luôn ghi rõ khoảng thời gian, múi giờ và tình trạng dữ liệu từng nguồn.
- [ ] Reboot Windows/WSL2 giữa task và hệ thống reconcile đúng.
- [ ] Khôi phục thành công database AI từ backup.
- [ ] Lỗi DB nguồn, Telegram và Claude API đều retry/cảnh báo đúng.
- [ ] Mọi con số trong phần AI truy ngược được về KPI snapshot.
- [ ] Chi phí nằm trong hạn mức.
- [ ] Không có PII trong prompt, log hoặc Telegram.

**Người đối chiếu và nghiệm thu:** __________  
**Ngày bắt đầu 14 ngày nghiệm thu:** __________

## 1.11. Điều kiện bắt đầu Giai đoạn 1B **BẮT BUỘC**

- [ ] 1A đạt toàn bộ tiêu chí nghiệm thu.
- [ ] Danh sách metric/query được phép đã duyệt.
- [ ] AI không có tool SQL tự do.
- [ ] Giới hạn 100 câu/ngày toàn group đã cấu hình.
- [ ] Giới hạn token và chi phí mỗi câu đã chốt.
- [ ] Có bộ câu hỏi eval và đáp án kỳ vọng.
- [ ] Có quy tắc từ chối câu hỏi ngoài phạm vi.

Khoảng thời gian tối đa người dùng được hỏi:

- [ ] 30 ngày.
- [ ] 90 ngày (đề xuất).
- [ ] Một năm.
- [ ] Tùy chọn nhưng giới hạn lượng dữ liệu trả về.

Có cho phép truy vấn theo từng SKU/mẫu thêu không? __________

## 1.12. Điều kiện đóng Giai đoạn 1

- [ ] Giai đoạn 1A đã nghiệm thu và chạy ổn định.
- [ ] Nếu triển khai 1B, bộ eval hỏi đáp đạt ngưỡng đã chốt.
- [ ] Chi phí tháng được đo bằng số liệu thực.
- [ ] Đã có runbook khởi động lại, khôi phục backup và xử lý lỗi.
- [ ] Các quyết định còn lại cho Giai đoạn 2 đã được ghi nhận.

**Người xác nhận đóng Giai đoạn 1:** __________  
**Ngày xác nhận:** __________

---

## Câu cần trả lời trước tiên

Để bắt đầu nhanh, trả lời theo thứ tự:

1. `0.1`: Cách kết nối database `lemiex-test`.
2. `0.3`–`0.8`: Công thức KPI xưởng, chi phí và SLA.
3. `0.9`: Ghi nhận phạm vi mở rộng sau MVP.
4. `0.10`: Tiêu chí dữ liệu đã đồng bộ đủ.
5. `1.1`: Phạm vi 1A.
6. `1.2`: Mẫu báo cáo.
7. `1.3`: Vai trò Claude.
8. `1.4`: Xử lý dữ liệu trễ.
9. `1.10`: Tiêu chí nghiệm thu.
