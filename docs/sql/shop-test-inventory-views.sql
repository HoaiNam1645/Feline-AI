-- Run on the shop-test MySQL server as an account allowed to create safe views.
-- Product catalog mockups are exposed for management-only visual matching.
-- Order mockups, supplier prices and shipping dimensions remain excluded.

CREATE OR REPLACE SQL SECURITY DEFINER VIEW `feline_ai_source`.`products` AS
SELECT
  `id`, `name`, `style`, `status`, `zero_stock_variants_active`,
  `category_type`, `mockup`, `brand`, `warehouse_name`,
  `created_at`, `updated_at`, `deleted_at`
FROM `lemiex-test`.`products`;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW `feline_ai_source`.`product_variants` AS
SELECT
  `id`, `product_id`, `variant_id`, `sku`, `style`, `color`, `size`,
  `stock`, `pending_demand`, `active`,
  `created_at`, `updated_at`, `deleted_at`
FROM `lemiex-test`.`product_variants`;

CREATE OR REPLACE SQL SECURITY DEFINER VIEW `feline_ai_source`.`product_decoration_methods` AS
SELECT `id`, `product_id`, `method`, `created_at`, `updated_at`
FROM `lemiex-test`.`product_decoration_methods`;
