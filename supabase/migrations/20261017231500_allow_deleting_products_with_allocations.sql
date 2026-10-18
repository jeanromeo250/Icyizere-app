DO $$
DECLARE
  product_fk RECORD;
BEGIN
  FOR product_fk IN
    SELECT conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.products'::regclass
      AND conrelid = 'public.employee_stock_allocations'::regclass
  LOOP
    EXECUTE format(
      'ALTER TABLE public.employee_stock_allocations DROP CONSTRAINT %I',
      product_fk.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.employee_stock_allocations
  ADD CONSTRAINT employee_stock_allocations_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id)
  ON DELETE CASCADE
  NOT VALID;
