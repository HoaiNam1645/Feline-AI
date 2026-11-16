# Mẫu báo cáo Telegram - Vận hành xưởng

> Mẫu được duyệt ngày 30/10/2026. Đây là dữ liệu thật đã tổng hợp, không chứa PII. Số backlog được chụp tại thời điểm khảo sát 11:42 ngày 30/10/2026, chưa phải snapshot đúng 08:00. Tạm thời chỉ hiển thị tuổi backlog, chưa gắn nhãn trễ SLA và chưa công bố tổng chi phí fulfillment.

```text
🏭 BÁO CÁO XƯỞNG LEMIEX — 29/10/2026
Kỳ dữ liệu: 00:00–24:00 giờ Việt Nam
Nguồn: shop-test · Trạng thái dữ liệu: Đủ cho KPI vận hành cơ bản

1. TIẾP NHẬN
• 99 đơn · 112 item · 112 sản phẩm
• So với hôm trước: 105 đơn, giảm 5,7%
• So với cùng thứ tuần trước: 134 đơn, giảm 26,1%
• Embroidery: 112 sản phẩm · Print: 0
• Loại đơn: 99 Shirt · Mức ưu tiên: 99 normal

2. HOÀN TẤT CÔNG ĐOẠN
• Staff: 145 đơn hoàn tất
• QC: 165 đơn hoàn tất
• Packing: 158 đơn hoàn tất
• Shipout: 158 đơn / 160 item hoàn tất

3. BACKLOG TẠI THỜI ĐIỂM SNAPSHOT
• Tổng: 171 đơn
• Confirm 49 · Pending stock 40 · QC pass 32
• Producing 28 · New order 21 · On hold 1
• Tuổi đơn: <24h 70 · 24–48h 30 · 48–72h 14 · ≥72h 57
• Thanh toán: Paid 149 · Pending 22

4. LỖI / HỦY / REMAKE
• Sự kiện hủy/refund xác nhận được trong kỳ: 0
• Remake tạo mới trong kỳ: 0
• Lưu ý: công thức refund theo ngày phát sinh đang chờ xác nhận

5. CHI PHÍ — TẠM KIỂM CHỨNG
• total_cost của cohort đơn mới: 2.288,10
• paid_cost: 2.022,60 · print_cost: 1.953,50
• extra_fee: 205,30 · shipping_cost: 129,30
• Chưa công bố “tổng chi phí fulfillment” trước khi chốt đơn vị tiền và thành phần

6. NHẬN XÉT
Dữ liệu cho thấy:
• Lượng đơn mới giảm so với cả hôm trước và cùng thứ tuần trước.
• Số đơn hoàn tất shipout (158) cao hơn số đơn mới (99), cho thấy xưởng đã xử lý thêm backlog.
• 57 đơn tồn từ 72 giờ trở lên; pending stock chiếm 40 đơn và là nhóm cần theo dõi riêng.

Cần kiểm tra:
• Nguyên nhân 33 đơn pending stock đã tồn từ 72 giờ trở lên.
• 20 đơn QC pass đã tồn từ 72 giờ trở lên có đang chờ đóng gói/shipout hay thiếu cập nhật workflow.
• Chốt SLA trước khi gắn nhãn các đơn này là “trễ”.

⚠️ Chất lượng dữ liệu
• orders.complete_time đang trống; báo cáo dùng thời điểm hoàn tất workflow shipout.
• Bảng tracking hiện chưa có dữ liệu.
```

## Ghi chú duyệt mẫu

Trước khi dùng chính thức cần chốt:

1. Có hiển thị phần chi phí trong group hay tách riêng.
2. Đơn vị tiền tệ và công thức chi phí.
3. SLA theo loại giao hàng/ưu tiên và cách xử lý `pending_stock`, `on_hold`.
4. Dùng `orders.created_at` hay thời điểm thanh toán làm mốc đơn mới.
5. Số dòng tối đa và mức chi tiết mong muốn trên Telegram.

