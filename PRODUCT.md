# Feline AI

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Chủ doanh nghiệp quản trị nền tảng và chốt chính sách.
- Manager quản lý các Agent, dữ liệu và nhân sự trong phạm vi được giao.
- User sử dụng Agent và dữ liệu theo quyền được cấp.

## Product Purpose

Feline AI là nền tảng nhiều AI theo từng lĩnh vực của doanh nghiệp. Hệ thống giúp người dùng hỏi đáp trên dữ liệu được phép, theo dõi vận hành và thực hiện các quy trình có kiểm soát.

CEO AI là Agent điều hành dự kiến tiếp nhận hỏi đáp nhân sự, tra cứu tri thức nội bộ và điều phối yêu cầu phê duyệt theo chính sách có cấu trúc.

TikTok AI hỗ trợ theo dõi vận hành Sell TikTok và hỏi đáp theo phạm vi được cấp. Dashboard TikTok cung cấp số liệu thực tế, chỉ đọc cho G9B và CashStorm Team.

Kế toán AI hỗ trợ Phòng Kế toán theo dõi tổng quan tài chính, hỏi đáp dữ liệu và tra cứu quy trình trong Knowledge Hub. Dữ liệu thu chi, yêu cầu mua hàng, tài khoản thanh toán, công nợ và quy đổi tiền được sử dụng ở chế độ chỉ đọc theo quyền của tài khoản.

## Positioning

Các AI dùng chung nền tảng phân quyền, audit và dữ liệu nhưng có nhiệm vụ, công cụ và phạm vi riêng. Quyền thực thi không được suy ra từ prompt, tài liệu vector hoặc thói quen lịch sử.

## Operating Context

- Hệ thống được sử dụng thật trong doanh nghiệp, không phải giao diện demo.
- Nền tảng có ba role quản trị: Admin, Manager và User.
- Người dùng và Manager không được thấy mô tả kỹ thuật nội bộ trên giao diện sử dụng.
- Nguồn dữ liệu nghiệp vụ ưu tiên quyền chỉ đọc; mọi request, lỗi, tool và chi phí cần audit.

## Capabilities and Constraints

- CEO AI ban đầu tập trung hỏi đáp nhân sự và tiếp nhận yêu cầu nội bộ.
- Dashboard TikTok chỉ tổng hợp dữ liệu thực tế của G9B và CashStorm Team; không bao gồm team Designs.
- Số liệu TikTok là chỉ đọc, tuân theo phạm vi truy cập của tài khoản và dùng múi giờ Los Angeles (PT) cho các mốc ngày tương đối.
- Dashboard Kế toán tổng hợp dòng tiền, thu chi, yêu cầu mua hàng, công nợ và tài khoản theo kỳ được chọn; các mốc thời gian hiển thị theo giờ Việt Nam.
- Kế toán AI chỉ đọc dữ liệu trong phạm vi được cấp, che thông tin tài chính nhạy cảm khi cần và không sửa giao dịch trực tiếp.
- Chat Kế toán kết hợp số liệu được phép xem với tài liệu nghiệp vụ đang áp dụng; Knowledge Hub Kế toán do Admin quản lý quyền đọc, phiên bản và hiệu lực tài liệu.
- Tri thức của CEO có thể được lưu và truy xuất bằng vector, kèm quyền truy cập và phiên bản tài liệu.
- Policy Engine, không phải vector search, quyết định thẩm quyền và hạn mức phê duyệt.
- Hành động nhạy cảm phải có data scope, quyền ủy quyền, điều kiện và audit phù hợp.
- Phạm vi dữ liệu HR và ma trận phê duyệt đang là quyết định mở của Giai đoạn 0.

## Brand Commitments

- Tên nền tảng: Feline AI.
- Tên Agent điều hành: CEO AI.
- Giao diện sáng, hiện đại, rõ ràng và dùng ngôn ngữ tiếng Việt tự nhiên.

## Evidence on Hand

- Đặc tả role và phân quyền: `docs/phan-quyen-va-chuc-nang-theo-role-v1.md`.
- Bản phân tích Giai đoạn 0 CEO AI: `docs/ceo-ai-giai-doan-0-pham-vi-an-toan.md`.
- Nền tảng Lemiex AI đã cung cấp kiến trúc tham chiếu cho Agent, capability, tool và audit.
- Dashboard TikTok đã triển khai thống kê theo team, kỳ thời gian, trạng thái đơn và hiệu suất seller từ nguồn dữ liệu chỉ đọc.
- Kế toán AI đã triển khai dashboard, chat và Knowledge Hub cho Phòng Kế toán với nguồn dữ liệu tài chính chỉ đọc theo phạm vi được cấp.

## Product Principles

- Mặc định từ chối khi không có quyền rõ ràng.
- Tách biệt tri thức, thói quen và quyền thực thi.
- Chỉ hiển thị thông tin người dùng cần để hoàn thành công việc.
- Thiết kế theo hướng mở rộng cho nhiều Agent và nhiều nguồn dữ liệu.
- Mọi quyết định quan trọng phải truy được căn cứ và người chịu trách nhiệm.

