-- ============================================
-- MIGRATION 2: Add price_list_id to sales
-- ============================================

-- 1. Add nullable column first
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS price_list_id UUID REFERENCES public.price_lists(id);

-- 2. Backfill historical sales with LISTA_PRECIO_VENTA_USD
UPDATE public.sales
SET price_list_id = (SELECT id FROM public.price_lists WHERE code = 'LISTA_PRECIO_VENTA_USD')
WHERE price_list_id IS NULL;

-- 3. Make NOT NULL
ALTER TABLE public.sales
  ALTER COLUMN price_list_id SET NOT NULL;

-- 4. Index for joins / lookups
CREATE INDEX IF NOT EXISTS idx_sales_price_list_id ON public.sales(price_list_id);