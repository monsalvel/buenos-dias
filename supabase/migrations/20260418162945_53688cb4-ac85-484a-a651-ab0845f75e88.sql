
-- Drop all existing permissive "Allow all" policies and replace with authenticated-only policies

-- customers
DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Authenticated users can manage customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- sales
DROP POLICY IF EXISTS "Allow all on sales" ON public.sales;
CREATE POLICY "Authenticated users can manage sales"
  ON public.sales FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- sale_items
DROP POLICY IF EXISTS "Allow all on sale_items" ON public.sale_items;
CREATE POLICY "Authenticated users can manage sale_items"
  ON public.sale_items FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- payments
DROP POLICY IF EXISTS "Allow all on payments" ON public.payments;
CREATE POLICY "Authenticated users can manage payments"
  ON public.payments FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- products
DROP POLICY IF EXISTS "Allow all on products" ON public.products;
CREATE POLICY "Authenticated users can manage products"
  ON public.products FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- bcv_rates
DROP POLICY IF EXISTS "Allow all on bcv_rates" ON public.bcv_rates;
CREATE POLICY "Authenticated users can read bcv_rates"
  ON public.bcv_rates FOR SELECT
  TO authenticated
  USING (true);
CREATE POLICY "Authenticated users can insert bcv_rates"
  ON public.bcv_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- store_settings
DROP POLICY IF EXISTS "Allow all on store_settings" ON public.store_settings;
CREATE POLICY "Authenticated users can manage store_settings"
  ON public.store_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
