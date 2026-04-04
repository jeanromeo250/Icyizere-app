-- Ensure can_view_stock column exists (added in previous migration but may not have been applied)
ALTER TABLE public.employee_permissions
ADD COLUMN IF NOT EXISTS can_view_stock BOOLEAN NOT NULL DEFAULT true;

-- Ensure employee_name column exists
ALTER TABLE public.employee_permissions
ADD COLUMN IF NOT EXISTS employee_name TEXT;