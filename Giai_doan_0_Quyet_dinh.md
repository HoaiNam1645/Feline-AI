# Giai đoạn 0 — Biên bản chốt quyết định

*Dự án: Multi-Agent AI vận hành doanh nghiệp · Ngày: 29/10/2026 · Tham chiếu: Tài liệu thiết kế v2.0, mục 13 và 17*

## 1. Bối cảnh doanh nghiệp

- **Mô hình:** bán hàng online đa kênh (TikTok Shop, Etsy, Shopify...) kết hợp sản xuất — xưởng thêu fulfillment.
- **Dữ liệu MVP:** hệ thống xưởng Lemiex tại `/var/www/shop-test/manage-lemiex`, database MySQL `lemiex-test` trên server `167.99.13.198`.
- **Mở rộng sau MVP:** kết nối hệ thống bán hàng `feline` trên server `165.22.58.187` để bổ sung doanh thu, lợi nhuận và phân tích theo kênh.
- **Nhân lực:** chủ doanh nghiệp tự lập trình và vận hành, dùng Claude Code hỗ trợ.

## 2. Các quyết định đã chốt

| # | Quyết định | Đã chốt | Ghi chú |
|---|---|---|---|
| 1 | Use case / Agent đầu tiên | **Báo cáo vận hành xưởng hằng ngày** (Agent chỉ đọc) | Mức R0 — tập trung đơn hàng, sản xuất, tồn đọng, trễ hạn và lỗi/remake |
| 2 | Nguồn dữ liệu | **`shop-test` / MySQL `lemiex-test`** trên `167.99.13.198` | Giai đoạn 0–1 chỉ dùng một nguồn; `feline` được mở rộng sau khi MVP ổn định |
| 3 | Cách truy cập dữ liệu | **Tài khoản DB chỉ đọc** (chỉ quyền SELECT trên các bảng cần thiết) | Xem lưu ý 4.4 |
| 4 | KPI bản đầu | Đơn mới · Item/sản phẩm cần làm · Trạng thái sản xuất · Tồn đọng và đơn trễ · Đơn đã ship · Đơn hủy/refund · Remake/lỗi · Chi phí fulfillment | Định nghĩa chi tiết ở mục 3 |
| 5 | Giờ gửi & kỳ chốt số liệu | **8h sáng, chốt theo giờ Việt Nam** (0h–24h hôm trước) | Xem lưu ý 4.2 |
| 6 | Kênh thông báo/phê duyệt | **Telegram** | |
| 7 | Người nhận | **Nhóm Telegram quản lý xem toàn bộ báo cáo xưởng**, kể cả chi phí fulfillment | Chỉ thêm người vào group sau khi cân nhắc; xem 4.6 |
| 8 | Ngưỡng cảnh báo bất thường | **Chạy thử 2 tuần** thu thập biến động thực tế, sau đó chốt ngưỡng | Giai đoạn 1 chỉ báo cáo, chưa cảnh báo |
| 9 | Ngân sách Claude API | **Hard cap 100 USD/tháng** | Cảnh báo ở 70% và 90% |
| 10 | Máy phát triển + production | **Máy Windows `192.168.1.99` + WSL2, chạy 24/24** | Vừa dùng để code vừa vận hành hệ thống; Docker Engine và toàn bộ runtime chạy trong Ubuntu WSL2 |
| 11 | Hàng đợi | **BullMQ + Redis** | Redis bật AOF để không mất job khi reboot |
| 12 | Backup ngoài máy chủ | **Ổ cứng / NAS khác trong xưởng** | Xem lưu ý 4.3 |

## 3. Định nghĩa KPI xưởng cần xác nhận

Đây là bản đề xuất. Mỗi dòng cần chủ doanh nghiệp xác nhận hoặc sửa trước khi viết SQL.

| KPI | Định nghĩa đề xuất | Cần xác nhận |
|---|---|---|
| Đơn mới | Số đơn được tạo trong ngày báo cáo | Có loại `test_order`, đơn đã xóa mềm và đơn hủy ngay trong ngày không? |
| Khối lượng item | Tổng item và tổng quantity cần xử lý | Báo cáo theo item hay quantity là chỉ số chính? |
| Trạng thái sản xuất | Số lượng theo `new_order`, `producing`, `qc_pass`, `confirm`, `pending_stock`, `on_hold`, `shipped`, `closed`, `cancelled` | Cách nhóm trạng thái để người quản lý dễ đọc? |
| Tồn đọng | Đơn/item chưa ship tại thời điểm chốt báo cáo | Có loại đơn `on_hold`, `pending_stock` hoặc đơn test không? |
| Đơn trễ | Đơn chưa ship và vượt SLA tính từ thời điểm nhận đơn | SLA chuẩn theo loại đơn, shipping method và mức ưu tiên là bao lâu? |
| Hoàn thành/đã ship | Đơn chuyển sang shipped/closed trong ngày | Dùng thời điểm nào để xác định ngày hoàn thành? |
| Hủy/refund | Số đơn hủy, full refund, partial refund và tổng phí refund | Tính theo ngày tạo đơn hay ngày phát sinh refund? |
| Remake/lỗi | Số item remake, nguyên nhân, bộ phận/người chịu trách nhiệm và chi phí | Trạng thái nào được tính là remake hoàn tất? |
| Chi phí fulfillment | `total_cost`, `paid_cost`, `print_cost`, `embroidery_fee`, `extra_fee`, `refund_fee`, `priority_fee` | Đơn vị tiền tệ và ý nghĩa chính xác của từng trường? |
| So sánh | Hôm qua · cùng thứ tuần trước · trung bình cùng thứ 4 tuần gần nhất | |

## 4. Lưu ý và rủi ro đã chấp nhận

### 4.1. Máy phát triển Windows + WSL2
- Máy đã khảo sát qua SSH ngày 29/10/2026: Windows 11 Pro build 22631; Intel Core i3-10105F (4 nhân/8 luồng); RAM 15,9 GB; ổ C 222 GB còn 96,9 GB; ổ D 931,5 GB còn 720,8 GB. Cấu hình đủ để phát triển và chạy thử MVP.
- Trạng thái hiện tại: WSL 3.0.3, Ubuntu 24.04 chạy ở WSL2; virtual disk đặt tại `D:\WSL\Ubuntu-24.04\ext4.vhdx`; `systemd` hoạt động.
- OpenSSH Server đang chạy và tự khởi động (`Automatic`). Khi cắm điện, máy đã đặt không tự sleep và không tự hibernate.
- Đã cài **Docker Engine trong WSL2**, không dùng Docker Desktop. Docker service đang `enabled` và `active`; Docker Compose và bài kiểm tra `hello-world` đã chạy thành công.
- Đặt mã nguồn trong filesystem Linux của WSL2, không đặt trực tiếp dưới `/mnt/c` hoặc `/mnt/d`, để tránh chậm I/O và lỗi quyền file.
- Có thể dùng ổ D để chứa WSL virtual disk do còn nhiều dung lượng; ổ D trên cùng máy không được tính là backup ngoài máy.
- Máy này đồng thời là production chạy 24/24. Bắt buộc cấu hình WSL/Docker/container tự khởi động sau reboot, backup ngoài máy, health check và cảnh báo mất dịch vụ ngay từ Giai đoạn 1.
- Đặt **Active Hours / tạm hoãn Windows Update**, cập nhật thủ công vào khung giờ ít việc.
- Cấu hình WSL và các container **tự khởi động khi Windows khởi động** (Task Scheduler + restart policy).
- Tắt chế độ ngủ/hibernate; nên có **UPS**.
- Kiểm tra hệ thống sau mỗi lần Windows update.

### 4.2. Chốt số liệu theo giờ Việt Nam
- MySQL lưu thời gian UTC. Khoảng 0h–24h giờ Việt Nam tương ứng 17:00 UTC ngày hôm trước đến 17:00 UTC ngày báo cáo.
- Thiết kế Metrics Engine lưu thời gian theo UTC và cho phép đổi múi giờ chốt số liệu sau này mà không phải sửa dữ liệu.

### 4.3. Backup trong cùng xưởng
- Bảo vệ được khi máy chủ hỏng ổ, **không bảo vệ** khi có sự cố tại địa điểm (cháy, ngập, trộm, ransomware lây qua mạng nội bộ).
- Tối thiểu: NAS dùng tài khoản riêng, không map ổ trực tiếp vào máy chủ; giữ nhiều phiên bản backup (7 ngày + 4 tuần).
- **Khuyến nghị bổ sung sau giai đoạn 1:** thêm một bản backup mã hóa lên cloud (chi phí thấp, dữ liệu hệ thống AI nhỏ).

### 4.4. Đọc database production bằng tài khoản chỉ đọc
- Chỉ cấp SELECT trên các bảng cần thiết; nếu có bảng chứa thông tin cá nhân khách hàng (tên, địa chỉ, email) thì **không cấp** hoặc chỉ cấp qua view đã bỏ các cột này.
- Truy vấn tổng hợp chạy theo lịch (ví dụ 6–7h sáng) và **lưu kết quả vào database của hệ thống AI**, không truy vấn database chính mỗi lần Agent cần số liệu.
- Kiểm tra các truy vấn nặng có index phù hợp để không làm chậm hệ thống xưởng.

### 4.5. Một người tự làm cùng Claude Code
- Tiến độ trong tài liệu v2.0 ước tính cho 1–2 lập trình viên; với một người làm bán thời gian cần **cộng thêm 30–50%** hoặc thu hẹp phạm vi.
- Giai đoạn 1 nên giữ thật gọn: một Agent, một báo cáo, Dashboard tối giản (có thể chỉ cần Telegram ở tuần đầu).
- Ưu tiên giải pháp ít thành phần, dễ tự vận hành; mọi cấu hình hạ tầng viết thành file trong repo để dựng lại được.

### 4.6. Bảo mật báo cáo trong group
- Toàn bộ báo cáo, kể cả chi phí fulfillment, gửi vào group quản lý. Người rời group không xem được báo cáo mới nhưng vẫn có thể giữ nội dung hoặc bản sao báo cáo cũ.
- Bot chỉ phản hồi trong group/chat ID đã đăng ký; bỏ qua mọi tin nhắn từ nơi khác.
- Thiết kế vẫn giữ khả năng tách luồng riêng cho chủ doanh nghiệp bằng cấu hình, phòng khi sau này cần.

## 5. Thông tin còn cần bổ sung trước khi code

| # | Việc cần làm | Người làm | Ghi chú |
|---|---|---|---|
| 1 | Xác nhận MySQL `lemiex-test` là nguồn production cho MVP | Chủ DN | Đã xác nhận ngày 29/10/2026 |
| 2 | Chốt các bảng/view chỉ đọc cho đơn hàng, item, production, workflow, remake và tracking | Chủ DN + kỹ thuật | Đã tạo schema `feline_ai_source` và user chỉ đọc ngày 30/10/2026; không cấp các cột PII |
| 3 | Xác nhận định nghĩa KPI ở mục 3 | Chủ DN | |
| 4 | Xác nhận cách nhóm trạng thái xưởng và SLA đơn trễ | Chủ DN | |
| 5 | Cấu hình máy phát triển: CPU, RAM, SSD, Windows, WSL2 và Internet | Chủ DN + kỹ thuật | Đã cài Ubuntu 24.04, Docker Engine, Node.js, pnpm và Git; repo tại `/home/thao/Feline-AI` |
| 6 | Tạo bot Telegram, group quản lý, lấy chat ID | Chủ DN | |
| 7 | Tạo API key Claude, đặt spend limit trên Anthropic Console | Chủ DN | Hard cap ở cả hai nơi: Console và hệ thống |
| 8 | Liệt kê 5–10 chủ đề tri thức quan trọng (ví dụ: quy trình sản xuất đơn thêu, xử lý đơn lỗi/hoàn, định giá) | Chủ DN | Phục vụ giai đoạn 2 |
| 9 | Số liệu nền: hiện mất bao lâu mỗi ngày để tổng hợp tình trạng xưởng, đơn trễ và lỗi/remake | Chủ DN | Để đo chỉ số thành công |

## 6. Sẵn sàng sang giai đoạn 1 khi

- [ ] Các mục 1–4 ở phần 5 đã hoàn thành (view/schema + KPI xưởng + SLA đã xác nhận)
- [x] Tài khoản DB chỉ đọc đã tạo và kết nối thử được từ máy chủ
- [x] Bật WSL và Virtual Machine Platform; cài Ubuntu 24.04 + Docker Engine; xác nhận môi trường phát triển chạy được
- [ ] Cấu hình máy Windows này làm production: tự khởi động, backup, health check, cảnh báo và kiểm thử reboot
- [ ] Bot Telegram và API key Claude đã sẵn sàng
- [ ] Vị trí backup trên NAS đã có, tài khoản riêng

---

## 7. Quyết định Giai đoạn 1 (chốt 29/10/2026)

| # | Quyết định | Đã chốt | Ghi chú |
|---|---|---|---|
| 1 | Mẫu báo cáo | Tổng quan đơn và item · Trạng thái sản xuất · Tồn đọng/trễ hạn · Đã ship · Hủy/refund · Remake/lỗi · Chi phí fulfillment | Số liệu do SQL tính |
| 2 | Vai trò AI trong báo cáo | **Số liệu + phân tích chi tiết**; **Haiku soạn số liệu, Sonnet viết phân tích** | Phân tích gắn với số liệu cụ thể, tách "dữ liệu cho thấy" / "có thể do". Xem 8.2 |
| 3 | Dữ liệu thiếu/trễ | **Gửi đúng giờ, đánh dấu bảng/nhóm dữ liệu thiếu**; gửi bản cập nhật khi đủ dữ liệu | |
| 4 | Hỏi đáp qua Telegram | **Có, hỏi tự do bằng AI trong Giai đoạn 1, làm ở đợt 1B**; giới hạn **100 câu/ngày** toàn group | Xem 8.3 và quyết định 9 |
| 5 | Phân quyền trong group | **Group xem tất cả** | Thay đổi quyết định #7 ở mục 2 |
| 6 | Nghiệm thu số liệu | **Khớp 100% trong 7 ngày đối chiếu** | Đối chiếu cùng khung giờ VN |
| 7 | Mặc định kỹ thuật | **Đồng ý tất cả:** Dashboard đăng nhập mật khẩu qua Tailscale; báo cáo dùng Haiku; đồng bộ KPI 6h, soạn 7h30, gửi 8h; giữ log 12 tháng; một repo + Docker Compose + Prisma | Xem 8.2 về Haiku |
| 9 | Chia Giai đoạn 1 làm 2 đợt | **1A: báo cáo hằng ngày chạy ổn định. 1B: thêm hỏi đáp tự do** | 1A đạt nghiệm thu thì mới làm 1B |
| 8 | Chủ đề tri thức cho Giai đoạn 2 | **Claude đề xuất danh sách 8–10 chủ đề, chủ doanh nghiệp duyệt** | Chưa thực hiện |

## 8. Điểm cần làm rõ từ các quyết định Giai đoạn 1

### 8.1. Phạm vi báo cáo MVP — đã đổi sang vận hành xưởng
Giai đoạn 1 chỉ dùng `shop-test`, chưa tính doanh thu và lợi nhuận bán hàng. Báo cáo tập trung vào khối lượng công việc, trạng thái sản xuất, tồn đọng, SLA, đơn đã ship, hủy/refund, remake/lỗi và chi phí fulfillment. Doanh thu/lợi nhuận sẽ bổ sung khi kết nối `feline` ở bước mở rộng.

### 8.2. "Phân tích chi tiết" — đã chốt Haiku + Sonnet
Phân tích nguyên nhân cần suy luận tốt hơn tóm tắt số liệu. Đã chốt: **Haiku soạn phần số liệu, Sonnet viết phần phân tích** (chạy 1 lần/ngày nên chi phí vẫn thấp, ước tính vài USD/tháng, nằm trong hard cap 100 USD). Cần xác nhận khi chạy thử.
Rủi ro: khi chưa có Company Brain, AI chỉ suy luận từ số liệu và có thể đoán sai nguyên nhân. Phân tích phải tách "dữ liệu cho thấy" khỏi "có thể do", và không đưa ra kết luận về nguyên nhân khi dữ liệu không đủ.

### 8.3. Hỏi đáp tự do bằng AI ở Giai đoạn 1
Làm sớm hơn kế hoạch gốc nên Giai đoạn 1 lớn hơn (+1–2 tuần). **Đã chốt chia 2 đợt:** 1A báo cáo hằng ngày trước, 1B hỏi đáp sau. Giới hạn **100 câu/ngày** toàn group. Các biện pháp bắt buộc:
- AI **không viết SQL tự do** lên database chính. Chỉ gọi các truy vấn/metric đã định nghĩa sẵn (tool có tham số: khoảng ngày, trạng thái, loại sản phẩm, phương pháp trang trí) qua Metrics Engine.
- Chỉ phản hồi trong group/chat ID đã đăng ký; giới hạn số câu hỏi mỗi ngày và token mỗi câu.
- Câu hỏi ngoài phạm vi dữ liệu thì trả lời "chưa có dữ liệu", không đoán.
- Tính vào ngân sách; cảnh báo khi dùng quá 70% mức dành cho hỏi đáp.
- Thông tin nhập từ tin nhắn Telegram được coi là dữ liệu, không phải lệnh hệ thống.

### 8.4. Việc tiếp theo
- Mẫu báo cáo và công thức tạm thời đã được duyệt ngày 30/10/2026: chỉ hiển thị tuổi backlog, chưa gắn nhãn trễ SLA và chưa công bố tổng chi phí fulfillment.
- Khung Giai đoạn 1A đã khởi tạo: NestJS API/worker, PostgreSQL, Prisma, BullMQ, Redis AOF và Docker Compose.
- Đã hoàn thành Connector MySQL chỉ đọc và Metrics Engine bản `0.1`; snapshot ngày 29/10/2026 đã được lưu vào PostgreSQL và khớp số liệu đối chiếu.
- Đã hoàn thành Report Engine `workshop-daily-v0.1`; artifact ngày 29/10/2026 đã được dựng hoàn toàn từ snapshot và đạt trạng thái `READY_TO_SEND`.
- Đã triển khai nền tảng Lemiex AI theo kiến trúc Agent/Capability/Tool/Provider/Audit; capability đầu tiên là đánh giá vận hành hằng ngày. Agent đang tắt an toàn do chưa có Anthropic API key/model.
- Tiếp theo: cấu hình Anthropic và chạy eval capability đầu tiên; sau đó tích hợp Telegram. Các capability backlog, data quality, hỏi đáp và planning được mở rộng độc lập.
- Danh sách chủ đề tri thức đề xuất cho Giai đoạn 2 (Claude soạn, chủ doanh nghiệp duyệt).

## 9. Quyết định phân quyền Dashboard (chốt 02/11/2026)

- Chốt 3 role người dùng: **Admin**, **Manager**, **User**.
- **Admin:** toàn quyền quản trị nền tảng.
- **Manager:** quản lý và phân quyền User theo các Agent được Admin giao; không thể cấp vượt phạm vi của mình.
- **User:** truy cập theo Agent, Capability, Data Scope và Action được cấp.
- Mặc định từ chối; backend kiểm tra quyền ở mọi API, không dựa vào việc ẩn menu frontend.
- Role người dùng độc lập với mức rủi ro AI `R0–R3`.
- Quyết định “Group xem tất cả” không còn là chính sách phân quyền chung. Báo cáo group chỉ được chứa dữ liệu mà toàn bộ thành viên hợp lệ đều được phép xem; dữ liệu phân quyền riêng dùng Dashboard hoặc private chat liên kết tài khoản.
- Đưa User/Role/Access Control lên triển khai ngay sau Dashboard nền tảng, sớm hơn lộ trình Giai đoạn 3 trong tài liệu v2.
- Đặc tả chi tiết: `docs/phan-quyen-va-chuc-nang-theo-role-v1.md` và bản PDF cùng tên.
