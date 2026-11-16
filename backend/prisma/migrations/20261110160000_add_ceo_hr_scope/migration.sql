INSERT INTO "DataScope" ("id", "agentId", "name", "description", "definition", "updatedAt") VALUES
  ('ceo.hr.knowledge', 'ceo-ai', 'Tri thức nhân sự', 'Tài liệu nhân sự đã công bố theo phạm vi phòng ban được phép đọc.', '{"datasets":["knowledge-documents","knowledge-chunks"],"pii":false,"departmentScoped":true}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "definition" = EXCLUDED."definition",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
