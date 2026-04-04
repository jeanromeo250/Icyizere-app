-- Rename employee_permissions columns from plural to singular to match current schema
ALTER TABLE public.employee_permissions
RENAME COLUMN can_add_products TO can_add_product;

ALTER TABLE public.employee_permissions
RENAME COLUMN can_edit_products TO can_edit_product;

ALTER TABLE public.employee_permissions
RENAME COLUMN can_delete_products TO can_delete_product;