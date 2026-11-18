INSERT INTO "OrganizationTeam" (
  "id",
  "departmentId",
  "code",
  "name",
  "externalSource",
  "externalId",
  "isActive",
  "updatedAt"
)
SELECT
  'team_etsy_tuyen',
  "id",
  'TUYEN',
  'Tuyen',
  'manager-felineez',
  'seller-team-tuyen',
  true,
  CURRENT_TIMESTAMP
FROM "Department"
WHERE "code" = 'ETSY'
ON CONFLICT ("departmentId", "code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "externalSource" = EXCLUDED."externalSource",
  "externalId" = EXCLUDED."externalId",
  "isActive" = true,
  "updatedAt" = CURRENT_TIMESTAMP;
