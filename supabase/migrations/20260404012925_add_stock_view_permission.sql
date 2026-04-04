-- Add can_view_stock permission to employee_permissions table
ALTER TABLE public.employee_permissions
ADD COLUMN can_view_stock BOOLEAN NOT NULL DEFAULT true;