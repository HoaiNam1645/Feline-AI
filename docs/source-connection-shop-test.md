# Kết nối nguồn chỉ đọc - shop-test

**Ngày tạo:** 30/10/2026  
**Server nguồn:** `167.99.13.198`  
**Database gốc:** `lemiex-test`  
**Schema an toàn cho AI:** `feline_ai_source`

## Kiểm soát truy cập

- MySQL user: `feline_ai_ro`.
- Chỉ được đăng nhập từ IP public của máy Windows tại thời điểm tạo: `118.70.39.230`.
- Bắt buộc kết nối TLS; lần kiểm thử dùng `TLS_AES_128_GCM_SHA256`.
- Chỉ có quyền `SELECT` trên `feline_ai_source.*`.
- Kiểm thử `UPDATE` từ WSL đã bị MySQL từ chối.
- Secret chỉ lưu trong `.env` trên máy Windows, quyền file `600`; không commit vào Git.

Nếu IP Internet của xưởng thay đổi, kết nối sẽ bị từ chối. Khi đó phải xác minh IP mới, đổi host của MySQL user và xoay mật khẩu; không mở user thành `%`.

## Các view được cấp

- `orders`
- `order_items`
- `productions`
- `order_item_workflows`
- `order_item_remakes`
- `tracking`
- `stores`
- `timeline`
- `products`
- `product_variants`
- `product_decoration_methods`

View sử dụng `SQL SECURITY DEFINER`, cho phép user AI đọc các cột đã duyệt mà không có quyền trực tiếp trên database `lemiex-test`.

## Dữ liệu bị loại

- Tên, số điện thoại và địa chỉ khách hàng.
- Shipping label, tracking ID/link và các URL tài liệu/mockup.
- Note, reason và nội dung tự do có thể chứa PII.
- Store API key.
- Tên/người chịu trách nhiệm và ID nhân sự trong workflow/remake.
- Các JSON payload không cần cho KPI.
- Giá nhà cung cấp, mockup đơn hàng và thông số vận chuyển của biến thể sản phẩm.

## Ảnh catalog sản phẩm

- `products.mockup` được cấp qua view chỉ đọc để Lemiex AI đối chiếu ảnh sản phẩm cho Admin/Manager.
- Không cấp mockup của đơn hàng hoặc file thiết kế của khách hàng.
- URL ảnh catalog chỉ dùng nội bộ trong pipeline so khớp và không hiển thị trong câu trả lời.

## Kết quả kiểm thử ban đầu

- Kết nối thành công từ WSL trên máy Windows.
- TLS hoạt động.
- User chỉ thấy schema được cấp cùng các schema hệ thống MySQL.
- Đọc được 15.844 đơn, 17.848 item và 17.844 production tại thời điểm kiểm thử.
- Truy vấn kiểm tra không tìm thấy các cột PII bị cấm trong schema view.
- Thao tác ghi bị từ chối đúng thiết kế.

