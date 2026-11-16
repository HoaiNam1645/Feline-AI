# Feline AI

Nền tảng Multi-Agent AI cho vận hành doanh nghiệp. Lemiex AI là domain agent đầu tiên.

## Thành phần hiện tại

- `backend/`: NestJS API và worker tách process.
- `frontend/`: React Dashboard cấp nền tảng, hỗ trợ menu nhiều Agent.
- PostgreSQL lưu task state, metric snapshot, báo cáo và audit.
- BullMQ + Redis AOF phân phối job.
- Prisma schema/migration.
- Docker Compose có healthcheck và restart policy.

Connector MySQL, Metrics Engine, Report Engine, Dashboard và Lemiex AI đã hoạt động. Anthropic đã được cấu hình; Telegram chưa được tích hợp.

Mô hình người dùng đã chốt gồm Admin, Manager và User; xem `docs/phan-quyen-va-chuc-nang-theo-role-v1.md`.

## Chạy local

```bash
cp .env.example .env
docker compose up --build -d
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/metrics/source/health
curl http://127.0.0.1:3000/metrics/workshop/daily/2026-10-29
curl http://127.0.0.1:3000/reports/workshop/daily/2026-10-29
curl http://127.0.0.1:3000/agents/lemiex
```

Dashboard: `http://127.0.0.1:8080`.

Không bật `SCHEDULER_ENABLED=true` trước khi tài khoản MySQL chỉ đọc, Telegram và quy trình retry/cảnh báo đã được cấu hình.
