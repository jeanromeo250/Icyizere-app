CREATE OR REPLACE FUNCTION public.manage_employee_stock(
  p_employee_user_id UUID,
  p_product_id UUID,
  p_quantity NUMERIC,
  p_action TEXT,
  p_target_employee_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  manager_id UUID := auth.uid();
  product_name TEXT;
  remaining NUMERIC;
BEGIN
  IF manager_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'A signed-in manager and positive quantity are required';
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('assign', 'return', 'transfer') THEN
    RAISE EXCEPTION 'Unsupported stock action';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.employee_permissions
    WHERE manager_user_id = manager_id
      AND employee_user_id = p_employee_user_id
  ) THEN
    RAISE EXCEPTION 'Employee is not managed by this account';
  END IF;

  IF p_action = 'transfer' AND (
    p_target_employee_user_id IS NULL
    OR p_target_employee_user_id = p_employee_user_id
    OR NOT EXISTS (
      SELECT 1
      FROM public.employee_permissions
      WHERE manager_user_id = manager_id
        AND employee_user_id = p_target_employee_user_id
    )
  ) THEN
    RAISE EXCEPTION 'Select another employee managed by this account';
  END IF;

  SELECT name INTO product_name
  FROM public.products
  WHERE id = p_product_id AND user_id = manager_id;

  IF product_name IS NULL THEN
    RAISE EXCEPTION 'Product is not owned by this manager';
  END IF;

  IF p_action = 'assign' THEN
    UPDATE public.products
    SET stock = stock - p_quantity
    WHERE id = p_product_id
      AND user_id = manager_id
      AND stock >= p_quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Not enough manager stock available';
    END IF;

    INSERT INTO public.employee_stock_allocations (
      manager_user_id, employee_user_id, product_id, quantity
    )
    VALUES (manager_id, p_employee_user_id, p_product_id, p_quantity)
    ON CONFLICT (employee_user_id, product_id)
    DO UPDATE SET quantity = public.employee_stock_allocations.quantity + EXCLUDED.quantity,
                  updated_at = now();

    INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
    VALUES (p_product_id, product_name, 'out', p_quantity, 'Stock assigned to employee', manager_id);
    INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
    VALUES (p_product_id, product_name, 'in', p_quantity, 'Stock received from manager', p_employee_user_id);
  ELSE
    UPDATE public.employee_stock_allocations
    SET quantity = quantity - p_quantity, updated_at = now()
    WHERE employee_user_id = p_employee_user_id
      AND product_id = p_product_id
      AND manager_user_id = manager_id
      AND quantity >= p_quantity
    RETURNING quantity INTO remaining;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Employee does not have enough stock';
    END IF;

    IF p_action = 'return' THEN
      UPDATE public.products
      SET stock = stock + p_quantity
      WHERE id = p_product_id AND user_id = manager_id;

      INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
      VALUES (p_product_id, product_name, 'out', p_quantity, 'Stock returned to manager', p_employee_user_id);
      INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
      VALUES (p_product_id, product_name, 'in', p_quantity, 'Stock returned by employee', manager_id);
    ELSE
      INSERT INTO public.employee_stock_allocations (
        manager_user_id, employee_user_id, product_id, quantity
      )
      VALUES (manager_id, p_target_employee_user_id, p_product_id, p_quantity)
      ON CONFLICT (employee_user_id, product_id)
      DO UPDATE SET quantity = public.employee_stock_allocations.quantity + EXCLUDED.quantity,
                    updated_at = now();

      INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
      VALUES (
        p_product_id, product_name, 'in', p_quantity,
        'Stock transferred from another employee', p_target_employee_user_id
      );
      INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
      VALUES (
        p_product_id, product_name, 'out', p_quantity,
        'Stock transferred to another employee', p_employee_user_id
      );
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_employee_stock(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_employee_stock(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;
