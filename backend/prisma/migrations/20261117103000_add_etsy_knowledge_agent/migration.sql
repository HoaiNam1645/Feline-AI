INSERT INTO "DataScope" ("id", "agentId", "name", "description", "definition", "updatedAt") VALUES
  ('etsy.knowledge', 'etsy-ai', 'Tri thức Sell Etsy', 'Tài liệu nghiệp vụ của phòng Sell Etsy được phân quyền theo phòng ban.', '{"datasets":["knowledge-documents","knowledge-chunks"],"pii":false,"departmentScoped":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "agentId" = EXCLUDED."agentId",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "definition" = EXCLUDED."definition",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Department" ("id", "code", "name", "agentId", "updatedAt") VALUES
  ('dept_etsy', 'ETSY', 'Phòng Sell Etsy', 'etsy-ai', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "agentId" = EXCLUDED."agentId",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
