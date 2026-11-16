# Kiến trúc Lemiex AI

**Phiên bản nền tảng:** 0.1  
**Ngày triển khai:** 31/10/2026  
**Domain:** vận hành xưởng Lemiex  
**Mức quyền hiện tại:** R0 - chỉ đọc, phân tích và đề xuất

## 1. Lemiex AI là gì

Lemiex AI là domain agent phụ trách vận hành xưởng Lemiex. Nó không phải CEO AI và không bị giới hạn vào việc viết nhận xét báo cáo.

Nhiệm vụ dài hạn:

- Đánh giá vận hành hằng ngày.
- Điều tra backlog theo dữ liệu đã duyệt.
- Theo dõi chất lượng dữ liệu và quy trình.
- Hỏi đáp vận hành qua danh mục metric/query cố định.
- Đề xuất ưu tiên sản xuất có phê duyệt của con người.

CEO AI sau này sẽ tổng hợp đầu ra từ Lemiex AI, Sales AI, Finance AI và các domain agent khác.

## 2. Kiến trúc mở rộng

```text
LemiexAgentService
  -> Capability Registry
       -> Daily Operations Review
       -> Backlog Investigation (planned)
       -> Data Quality Review (planned)
       -> Operations Q&A (planned)
       -> Production Planning (planned, R1)
  -> Tool Registry
       -> Daily Metric Snapshot
       -> Deterministic Report Artifact
       -> Các tool metric được duyệt sau này
  -> Structured AI Provider
       -> Anthropic hiện tại
       -> Có thể thêm provider khác mà không đổi capability
  -> AgentRun / AgentToolCall Audit
```

Orchestrator không hard-code input hoặc output của capability cụ thể. Mỗi capability tự xác thực input và trả về hợp đồng kết quả chung; capability đăng ký qua injection token `LEMIEX_CAPABILITIES`. Thêm capability mới không cần sửa controller, luồng audit hoặc model provider.

## 3. Capability hiện có

### `lemiex.operations.daily-review`

- Đọc metric snapshot đã lưu trong PostgreSQL.
- Đọc báo cáo deterministic đã dựng.
- Loại `source`, độ tươi chi tiết và `provisionalCosts` khỏi context gửi model.
- Yêu cầu model trả structured output qua tool schema.
- Tách `dataShows`, `needsInvestigation`, `operationalPriorities` và `limitations`.
- Chặn con số không tồn tại trong context bằng numerical grounding validator.
- Tối đa ba đề xuất ưu tiên và không thực thi hành động.

Đây là capability đầu tiên của Lemiex AI, không phải toàn bộ Lemiex AI.

## 4. Capability đã định tuyến để mở rộng

| Capability | Trạng thái | Quyền |
|---|---|---|
| Daily operations review | Available | R0 |
| Backlog investigation | Planned | R0 |
| Data quality review | Planned | R0 |
| Operations Q&A | Available | R0 |
| Production planning | Planned | R1 - cần phê duyệt |

Capability ở trạng thái `planned` trả lỗi rõ ràng và chưa thể bị gọi nhầm.

## 5. Tool và giới hạn dữ liệu

Model không có quyền SQL, MySQL hoặc Prisma trực tiếp. Capability chỉ gọi tool đã đăng ký:

- `lemiex.metrics.daily-snapshot`
- `lemiex.reports.daily-artifact`

Mỗi tool call được đối chiếu runtime với `allowedTools` của capability rồi mới thực thi. Input, output, trạng thái và thời gian được lưu trong `AgentToolCall`. Các tool mới phải có input/output rõ ràng và chỉ trả dữ liệu tối thiểu cần thiết.

## 6. Audit và chi phí

Mỗi lần Agent chạy tạo `AgentRun` gồm:

- Agent ID và capability ID.
- Input/output structured JSON.
- Metric snapshot liên quan.
- Prompt version và model.
- Input/output token.
- Chi phí ước tính nếu đã cấu hình đơn giá.
- Lỗi và thời gian hoàn tất.
- Danh sách tool call.

Không có API key thì không tạo AgentRun giả và không phát sinh chi phí.

## 7. Fallback

Lemiex AI không được làm hỏng báo cáo số liệu:

```text
Metrics Engine -> Report Engine -> READY_TO_SEND
                              -> Lemiex AI (nếu enabled)
```

Nếu model lỗi, timeout, vượt budget hoặc output không đạt grounding, báo cáo deterministic vẫn giữ trạng thái sẵn sàng gửi.

## 8. API nội bộ

- `GET /agents/lemiex`: xem identity, boundary, provider, capability và tool.
- `POST /agents/lemiex/runs`: chạy capability available với `{ "capabilityId": "...", "input": { ... } }`. Dạng cũ đặt `reportDate` ở cấp ngoài vẫn được hỗ trợ.
- `GET /agents/lemiex/runs`: xem lịch sử chạy.
- `GET /agents/lemiex/runs/:id`: xem chi tiết và tool calls.

API hiện chỉ bind vào localhost.

## 9. Trạng thái triển khai

- Database migration cho `AgentRun` và `AgentToolCall`: hoàn tất.
- Anthropic structured provider: hoàn tất.
- Capability registry và tool registry: hoàn tất.
- Daily review capability và grounding guard: hoàn tất.
- Tích hợp fallback vào report worker: hoàn tất.
- Kiểm thử provider thật: đã chạy thành công với Anthropic và dữ liệu báo cáo `shop-test` ngày 29/10/2026.
- Model triển khai hiện tại: `claude-sonnet-4-6`; cấu hình qua môi trường để có thể đổi model mà không sửa capability.
- Lemiex AI đã bật trên máy WSL vận hành; báo cáo deterministic vẫn là fallback độc lập.
- Chatbox hỏi đáp cơ bản đã triển khai với lịch sử hội thoại, Markdown, SSE và grounding trước khi stream.

API key Anthropic cấp ở phạm vi tổ chức cần thêm `ANTHROPIC_WORKSPACE_ID`. Key đã scope trực tiếp vào workspace không cần biến này. Endpoint identity chỉ công khai trạng thái đã cấu hình, không trả về giá trị key hoặc workspace ID.

## 10. Cách thêm capability mới

1. Tạo tool chỉ đọc với input/output tối thiểu.
2. Đăng ký tool trong `AgentToolExecutorService`.
3. Tạo capability implement `AgentCapability`.
4. Đăng ký capability vào `LEMIEX_CAPABILITIES` trong `AgentsModule`.
5. Thêm capability definition, risk level và allowed tools.
6. Viết grounding/eval rồi mới chuyển trạng thái từ `planned` sang `available`.

