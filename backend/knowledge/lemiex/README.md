# Lemiex Business Knowledge

Bộ catalog máy đọc được chắt lọc từ `Lemiex.md`. Nội dung runtime chỉ chứa định nghĩa nghiệp vụ và chính sách đã đủ an toàn để đưa vào prompt.

- `agent.json`: danh tính, nhiệm vụ và ranh giới.
- `glossary.json`: thuật ngữ nghiệp vụ.
- `entities.json`: mục đích bảng và trường nhạy cảm.
- `statuses.json`: ánh xạ trạng thái.
- `metrics.json`: metric, đơn vị và mức sẵn sàng.
- `policies.json`: quy tắc trả lời, thiếu dữ liệu và từ chối.
- `test-questions.json`: câu hỏi hồi quy nghiệp vụ.

Các thay đổi phải được đối chiếu với source Lemiex, schema production và Metrics Engine. Nội dung `planned`, `planned_restricted` hoặc `unavailable` không tự cấp quyền truy cập dữ liệu.
