DROP POLICY IF EXISTS "Users can manage own and managed sales" ON public.sales;

CREATE POLICY "Users can manage own and managed sales"
  ON public.sales
  FOR ALL
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.employee_permissions ep
      WHERE ep.employee_user_id = sales.user_id
        AND ep.manager_user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.employee_permissions ep
      WHERE ep.employee_user_id = sales.user_id
        AND ep.manager_user_id = auth.uid()
    )
  );
