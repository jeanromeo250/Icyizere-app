ALTER TABLE public.sales
  ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'unspecified'
  CHECK (payment_method IN ('cash', 'mobile_money', 'bank_transfer', 'card', 'other', 'unspecified'));

DROP FUNCTION public.consume_employee_stock(UUID, NUMERIC, TEXT, NUMERIC, DATE, TEXT, TEXT);

CREATE FUNCTION public.consume_employee_stock(
  p_product_id UUID,
  p_quantity NUMERIC,
  p_kind TEXT,
  p_total NUMERIC DEFAULT 0,
  p_date DATE DEFAULT CURRENT_DATE,
  p_employee_name TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_payment_method TEXT DEFAULT 'unspecified'
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

  IF p_payment_method IS NULL OR p_payment_method NOT IN ('cash', 'mobile_money', 'bank_transfer', 'card', 'other', 'unspecified') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT ep.manager_user_id, ep.can_record_sales, ep.can_remove_stock
  INTO manager_id, can_record_sales, can_remove_stock
  FROM public.employee_permissions ep
  WHERE ep.employee_user_id = employee_id;

  IF manager_id IS NULL THEN
    RAISE EXCEPTION 'Employee is not linked to a manager';
  END IF;

  IF (p_kind = 'sale' AND NOT COALESCE(can_record_sales, false))
    OR (p_kind = 'out' AND NOT COALESCE(can_remove_stock, false)) THEN
    RAISE EXCEPTION 'You do not have permission to consume employee stock';
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
      product_id, product_name, quantity, total, date, employee_name, user_id, payment_method
    )
    VALUES (
      p_product_id, product_name, p_quantity, COALESCE(p_total, 0), COALESCE(p_date, CURRENT_DATE),
      COALESCE(p_employee_name, 'Employee'), employee_id, p_payment_method
    )
    RETURNING id INTO sale_id;
  ELSE
    INSERT INTO public.stock_entries (product_id, product_name, type, quantity, note, user_id)
    VALUES (p_product_id, product_name, 'out', p_quantity, COALESCE(p_note, ''), employee_id);
  END IF;

  RETURN sale_id;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_employee_stock(UUID, NUMERIC, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_employee_stock(UUID, NUMERIC, TEXT, NUMERIC, DATE, TEXT, TEXT, TEXT) TO authenticated;
