INSERT INTO "DataScope" ("id", "agentId", "name", "description", "definition", "updatedAt") VALUES
  ('tiktok.data.all', 'tiktok-ai', 'Toàn bộ dữ liệu TikTok', 'Toàn bộ miền dữ liệu và toàn bộ team/store/seller TikTok.', '{"domain":"all","rowScope":"all","pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.overview', 'tiktok-ai', 'Tổng quan TikTok', 'Số đơn, item, trạng thái và cảnh báo chất lượng.', '{"domain":"overview","pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.orders', 'tiktok-ai', 'Đơn hàng TikTok', 'Tra cứu và tổng hợp đơn hàng trong phạm vi được cấp.', '{"domain":"orders","pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.finance', 'tiktok-ai', 'Tài chính TikTok', 'Doanh số, quyết toán, refund, ads, chi phí và lợi nhuận.', '{"domain":"finance","financial":true,"pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.team', 'tiktok-ai', 'Team và seller TikTok', 'KPI team, seller và creator.', '{"domain":"team","pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.stores', 'tiktok-ai', 'Store TikTok', 'Sức khỏe, trạng thái và hiệu suất store.', '{"domain":"stores","pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.fulfillment', 'tiktok-ai', 'Fulfillment TikTok', 'Xưởng, vendor, chi phí, SLA và dữ liệu thiếu.', '{"domain":"fulfillment","pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('tiktok.data.design', 'tiktok-ai', 'Design TikTok', 'Workflow, backlog và KPI design.', '{"domain":"design","pii":false}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "agentId" = EXCLUDED."agentId",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "definition" = EXCLUDED."definition",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
