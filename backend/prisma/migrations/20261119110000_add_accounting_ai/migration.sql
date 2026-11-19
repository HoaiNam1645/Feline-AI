INSERT INTO "DataScope" ("id", "agentId", "name", "description", "definition", "updatedAt") VALUES
  ('accounting.knowledge', 'accounting-ai', 'Tri thức Kế toán', 'Tài liệu nghiệp vụ kế toán được phân quyền theo phòng ban.', '{"datasets":["knowledge-documents","knowledge-chunks"],"pii":false,"departmentScoped":true}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.all', 'accounting-ai', 'Toàn bộ dữ liệu Kế toán', 'Toàn bộ miền dữ liệu kế toán ở chế độ chỉ đọc.', '{"domain":"all","access":"read-only","financial":true,"pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.overview', 'accounting-ai', 'Tổng quan tài chính', 'Thu, chi, dòng tiền ròng và các chỉ số kế toán tổng hợp.', '{"domain":"overview","access":"read-only","financial":true,"pii":false}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.transactions', 'accounting-ai', 'Giao dịch thu chi', 'Giao dịch thu chi trong phạm vi thời gian được cấp.', '{"domain":"transactions","access":"read-only","financial":true,"pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.purchases', 'accounting-ai', 'Yêu cầu mua hàng', 'Đề nghị mua hàng, trạng thái và lịch sử phê duyệt.', '{"domain":"purchases","access":"read-only","financial":true,"pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.accounts', 'accounting-ai', 'Tài khoản thanh toán', 'Dòng tiền theo tài khoản với số tài khoản đã che.', '{"domain":"accounts","access":"read-only","financial":true,"pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.receivables', 'accounting-ai', 'Công nợ phải thu', 'Công nợ, đối tác, hạn thanh toán và số tiền còn lại.', '{"domain":"receivables","access":"read-only","financial":true,"pii":"masked"}'::jsonb, CURRENT_TIMESTAMP),
  ('accounting.data.conversions', 'accounting-ai', 'Quy đổi tiền', 'Các yêu cầu và kết quả quy đổi tiền tệ.', '{"domain":"conversions","access":"read-only","financial":true,"pii":"masked"}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET
  "agentId" = EXCLUDED."agentId",
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "definition" = EXCLUDED."definition",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Department" ("id", "code", "name", "agentId", "updatedAt") VALUES
  ('dept_accounting', 'ACCOUNTING', 'Phòng Kế toán', 'accounting-ai', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "agentId" = EXCLUDED."agentId",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "OrganizationTeam" ("id", "departmentId", "code", "name", "externalSource", "externalId", "updatedAt")
SELECT 'team_accounting', "id", 'ACCOUNTING', 'Kế toán', 'accountant-felineez', 'accounting', CURRENT_TIMESTAMP
FROM "Department"
WHERE "code" = 'ACCOUNTING'
ON CONFLICT ("departmentId", "code") DO NOTHING;
