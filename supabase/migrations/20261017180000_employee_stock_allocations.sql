CREATE TABLE public.employee_stock_allocations (
  manager_user_id UUID NOT NULL,
  employee_user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (employee_user_id, product_id)
);

CREATE INDEX employee_stock_allocations_manager_idx
  ON public.employee_stock_allocations (manager_user_id, employee_user_id);

ALTER TABLE public.employee_stock_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers and employees can view their stock allocations"
  ON public.employee_stock_allocations FOR SELECT TO authenticated
  USING (
    auth.uid() = manager_user_id
    OR auth.uid() = employee_user_id
  );

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

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = manager_id AND role = 'manager'
  ) THEN
    RAISE EXCEPTION 'Only managers can manage employee stock';
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
    INSERT INTO public.employee_stock_allocations (
      manager_user_id, employee_user_id, product_id, quantity
    )
    VALUES (manager_id, p_employee_user_id, p_product_id, p_quantity)
    ON CONFLICT (employee_user_id, product_id)
    DO UPDATE SET quantity = public.employee_stock_allocations.quantity + EXCLUDED.quantity,
                  updated_at = now();

    INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
    VALUES (p_product_id, product_name, 'in', p_quantity, 'Stock assigned by manager', p_employee_user_id);
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

CREATE OR REPLACE FUNCTION public.consume_employee_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_kind TEXT,
  p_total NUMERIC DEFAULT 0,
  p_date DATE DEFAULT CURRENT_DATE,
  p_employee_name TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  employee_id UUID := auth.uid();
  manager_id UUID;
  product_name TEXT;
  remaining NUMERIC;
  sale_id UUID;
  can_record_sales BOOLEAN;
  can_remove_stock BOOLEAN;
BEGIN
  IF employee_id IS NULL OR p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'A signed-in employee and positive quantity are required';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('sale', 'out') THEN
    RAISE EXCEPTION 'Unsupported stock consumption type';
  END IF;

  IF (p_kind = 'sale' AND NOT COALESCE(can_record_sales, false))
    OR (p_kind = 'out' AND NOT COALESCE(can_remove_stock, false)) THEN
    RAISE EXCEPTION 'You do not have permission to consume employee stock';
  END IF;

  SELECT ep.manager_user_id, ep.can_record_sales, ep.can_remove_stock
  INTO manager_id, can_record_sales, can_remove_stock
  FROM public.employee_permissions ep
  WHERE ep.employee_user_id = employee_id;

  IF manager_id IS NULL THEN
    RAISE EXCEPTION 'Employee is not linked to a manager';
  END IF;

  SELECT name INTO product_name
  FROM public.products
  WHERE id = p_product_id AND user_id = manager_id;

  IF product_name IS NULL THEN
    RAISE EXCEPTION 'Product is not available to this employee';
  END IF;

  UPDATE public.employee_stock_allocations
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE employee_user_id = employee_id
    AND product_id = p_product_id
    AND manager_user_id = manager_id
    AND quantity >= p_quantity
  RETURNING quantity INTO remaining;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not enough employee stock available';
  END IF;

  IF p_kind = 'sale' THEN
    IF COALESCE(p_total, 0) < 0 THEN
      RAISE EXCEPTION 'Sale total cannot be negative';
    END IF;
    INSERT INTO public.sales (
      product_id, product_name, quantity, total, date, employee_name, user_id
    )
    VALUES (
      p_product_id, product_name, p_quantity, COALESCE(p_total, 0), COALESCE(p_date, CURRENT_DATE),
      COALESCE(p_employee_name, 'Employee'), employee_id
    )
    RETURNING id INTO sale_id;
  ELSE
    INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
    VALUES (p_product_id, product_name, 'out', p_quantity, COALESCE(p_note, ''), employee_id);
  END IF;

  RETURN sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.manage_employee_stock(UUID, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manage_employee_stock(UUID, UUID, NUMERIC, TEXT, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.consume_employee_stock(UUID, NUMERIC, TEXT, NUMERIC, DATE, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_employee_stock(UUID, NUMERIC, TEXT, NUMERIC, DATE, TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Auth users can manage stock entries" ON public.stock_entries;

CREATE POLICY "Users can view own or managed stock entries"
  ON public.stock_entries FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.employee_permissions ep
      WHERE ep.employee_user_id = stock_entries.user_id
        AND ep.manager_user_id = auth.uid()
    )
  );

CREATE POLICY "Managers can add own stock entries"
  ON public.stock_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can update own stock entries"
  ON public.stock_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Managers can delete own stock entries"
  ON public.stock_entries FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
