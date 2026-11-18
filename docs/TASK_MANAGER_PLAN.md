# Task Manager - kế hoạch triển khai

## Mục tiêu

CEO giao công việc cho phòng ban, theo dõi tiến độ, nhận kết quả và duyệt hoàn thành. TikTok là phòng ban đầu tiên; lõi dữ liệu dùng `departmentCode` và `agentId` để mở rộng mà không đổi quy trình.

## Quy trình chuẩn

`Nháp → Đã giao → Đã nhận → Đang làm → Chờ kiểm tra → Hoàn thành`

Nhánh xử lý bổ sung: `Bị chặn`, `Cần làm lại`, `Đã hủy`.

## Phân quyền

| Vai trò | Quyền |
| --- | --- |
| Admin / CEO | Tạo, giao, sửa, hủy, kiểm tra và duyệt hoàn thành mọi công việc |
| Manager | Xem và cập nhật công việc thuộc phòng ban của mình |
| User | Xem và cập nhật công việc được giao trực tiếp |

Mọi thay đổi trạng thái, tiến độ và ghi chú đều được lưu vào dòng thời gian và nhật ký kiểm soát.

## Các giai đoạn

### Giai đoạn 1 - Nền tảng công việc

- Danh sách, tìm kiếm và lọc theo trạng thái.
- Giao việc cho phòng Sell TikTok.
- Tiến độ, thời hạn, mức ưu tiên và lịch sử cập nhật.
- CEO duyệt hoàn thành hoặc yêu cầu làm lại.

### Giai đoạn 2 - Phối hợp

- Bình luận có nhắc tên, người theo dõi và file đính kèm.
- Thông báo khi được giao, gần hạn, quá hạn hoặc bị trả lại.
- Bộ lọc theo người nhận, thời hạn và mức ưu tiên.

### Giai đoạn 3 - Agent hỗ trợ

- CEO AI đề xuất task từ báo cáo nhưng không tự giao hoặc tự duyệt.
- TikTok AI đính kèm số liệu kiểm chứng vào kết quả task.
- Liên kết `AgentRun` với task để theo dõi phần việc do AI thực hiện.

### Giai đoạn 4 - Điều hành đa phòng ban

- Thêm Lemiex, Etsy, Fela bằng cấu hình phòng ban.
- Dashboard tải công việc, đúng hạn và thời gian xử lý theo phòng ban.
- Quy trình mẫu và task lặp theo ngày, tuần hoặc tháng.

## Tiêu chí nghiệm thu giai đoạn 1

1. CEO tạo và giao được task cho tài khoản thuộc phòng TikTok.
2. Người nhận chỉ thấy task được phép xem và cập nhật được tiến độ.
3. Manager thấy toàn bộ task trong phòng ban được cấp.
4. CEO thấy task chờ kiểm tra, duyệt hoàn thành hoặc yêu cầu làm lại.
5. Task quá hạn được đánh dấu rõ nhưng không tự đổi trạng thái.
6. Mọi cập nhật xuất hiện đúng thứ tự trong lịch sử và audit log.
