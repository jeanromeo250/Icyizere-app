-- Ensure all authenticated users can view the full products catalog
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Recreate product access policies to allow full SELECT access for authenticated users
DROP POLICY IF EXISTS "Auth users can manage products" ON public.products;

CREATE POLICY "Auth users can select products" ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Auth users can insert products" ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Auth users can update products" ON public.products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Auth users can delete products" ON public.products
  FOR DELETE
  TO authenticated
  USING (true);
