ALTER TABLE public.products
  ALTER COLUMN stock TYPE NUMERIC USING stock::NUMERIC,
  ALTER COLUMN min_stock TYPE NUMERIC USING min_stock::NUMERIC;

ALTER TABLE public.sales
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;

ALTER TABLE public.stock_entries
  ALTER COLUMN quantity TYPE NUMERIC USING quantity::NUMERIC;
