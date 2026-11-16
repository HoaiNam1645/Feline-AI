INSERT INTO "DataScope" ("id", "agentId", "name", "description", "definition", "updatedAt") VALUES
  ('tiktok.knowledge', 'tiktok-ai', 'Tri thức Sell TikTok', 'Tài liệu Sell TikTok đã công bố theo phạm vi phòng ban được phép đọc.', '{"datasets":["knowledge-documents","knowledge-chunks"],"pii":false,"departmentScoped":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "agentId" = EXCLUDED."agentId",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "definition" = EXCLUDED."definition",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
