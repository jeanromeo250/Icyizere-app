-- Add employee_name to employee_permissions so manager-created employees can store display names
ALTER TABLE public.employee_permissions
ADD COLUMN IF NOT EXISTS employee_name TEXT;
