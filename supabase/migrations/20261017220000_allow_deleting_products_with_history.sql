DO $$
DECLARE
  product_fk RECORD;
BEGIN
  FOR product_fk IN
    SELECT conrelid::regclass AS table_name, conname
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.products'::regclass
      AND conrelid IN ('public.sales'::regclass, 'public.stock_entries'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', product_fk.table_name, product_fk.conname);
  END LOOP;
END $$;

ALTER TABLE public.sales
  ADD CONSTRAINT sales_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id)
  ON DELETE SET NULL
  NOT VALID;

ALTER TABLE public.stock_entries
  ADD CONSTRAINT stock_entries_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES public.products(id)
  ON DELETE SET NULL
  NOT VALID;
