-- ============================================
-- MIGRATION 1: Price Lists schema + seed + RPC + RLS
-- ============================================

-- 1. Enum for list kind
DO $$ BEGIN
  CREATE TYPE public.price_list_kind AS ENUM ('sale', 'cost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. price_lists table
CREATE TABLE IF NOT EXISTS public.price_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kind public.price_list_kind NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. price_list_prices table (SCD Type 2)
CREATE TABLE IF NOT EXISTS public.price_list_prices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  price_list_id UUID NOT NULL REFERENCES public.price_lists(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_price NUMERIC NOT NULL CHECK (unit_price >= 0),
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to TIMESTAMPTZ NULL,
  note TEXT NULL,
  created_by_email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_plp_lookup ON public.price_list_prices(price_list_id, product_id, valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_plp_active ON public.price_list_prices(price_list_id, product_id) WHERE valid_to IS NULL;

-- 5. Enable RLS
ALTER TABLE public.price_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_list_prices ENABLE ROW LEVEL SECURITY;

-- 6. RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage price_lists" ON public.price_lists;
CREATE POLICY "Authenticated users can manage price_lists"
  ON public.price_lists FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage price_list_prices" ON public.price_list_prices;
CREATE POLICY "Authenticated users can manage price_list_prices"
  ON public.price_list_prices FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 7. updated_at trigger on price_lists
DROP TRIGGER IF EXISTS trg_price_lists_updated_at ON public.price_lists;
CREATE TRIGGER trg_price_lists_updated_at
  BEFORE UPDATE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Seed system lists (idempotent)
INSERT INTO public.price_lists (code, name, kind, currency, is_system)
VALUES
  ('LISTA_PRECIO_VENTA_USD', 'LISTA PRECIO VENTA USD', 'sale', 'USD', true),
  ('LISTA_PRECIO_COSTO_USD', 'LISTA PRECIO COSTO USD', 'cost', 'USD', true)
ON CONFLICT (code) DO NOTHING;

-- 9. Backfill: insert current prices of all active products as initial version (only if not already)
INSERT INTO public.price_list_prices (price_list_id, product_id, unit_price, valid_from, note)
SELECT pl.id, p.id, p.price, p.created_at, 'Versión inicial (carga automática)'
FROM public.products p
CROSS JOIN public.price_lists pl
WHERE pl.code = 'LISTA_PRECIO_VENTA_USD'
  AND p.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.price_list_prices x
    WHERE x.price_list_id = pl.id AND x.product_id = p.id
  );

INSERT INTO public.price_list_prices (price_list_id, product_id, unit_price, valid_from, note)
SELECT pl.id, p.id, p.cost, p.created_at, 'Versión inicial (carga automática)'
FROM public.products p
CROSS JOIN public.price_lists pl
WHERE pl.code = 'LISTA_PRECIO_COSTO_USD'
  AND p.active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.price_list_prices x
    WHERE x.price_list_id = pl.id AND x.product_id = p.id
  );

-- 10. Function: get active price
CREATE OR REPLACE FUNCTION public.get_active_price(
  _list_id UUID,
  _product_id UUID,
  _at TIMESTAMPTZ DEFAULT now()
)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT unit_price
  FROM public.price_list_prices
  WHERE price_list_id = _list_id
    AND product_id = _product_id
    AND valid_from <= _at
    AND (valid_to IS NULL OR valid_to > _at)
  ORDER BY valid_from DESC
  LIMIT 1;
$$;

-- 11. RPC: set_product_price (closes current, opens new version)
CREATE OR REPLACE FUNCTION public.set_product_price(
  _list_id UUID,
  _product_id UUID,
  _new_price NUMERIC,
  _note TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id UUID;
  user_email TEXT;
  current_active_id UUID;
  current_active_price NUMERIC;
BEGIN
  IF _new_price IS NULL OR _new_price < 0 THEN
    RAISE EXCEPTION 'invalid_price' USING MESSAGE = 'El precio debe ser mayor o igual a 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.price_lists WHERE id = _list_id) THEN
    RAISE EXCEPTION 'price_list_not_found' USING MESSAGE = 'Lista de precios no encontrada';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = _product_id) THEN
    RAISE EXCEPTION 'product_not_found' USING MESSAGE = 'Producto no encontrado';
  END IF;

  user_email := COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email',
    'system'
  );

  -- Find current active version
  SELECT id, unit_price INTO current_active_id, current_active_price
  FROM public.price_list_prices
  WHERE price_list_id = _list_id
    AND product_id = _product_id
    AND valid_to IS NULL
  ORDER BY valid_from DESC
  LIMIT 1;

  -- If price hasn't changed, do nothing and return current id
  IF current_active_id IS NOT NULL AND current_active_price = _new_price THEN
    RETURN current_active_id;
  END IF;

  -- Close current active version
  IF current_active_id IS NOT NULL THEN
    UPDATE public.price_list_prices
    SET valid_to = now()
    WHERE id = current_active_id;
  END IF;

  -- Insert new version
  INSERT INTO public.price_list_prices (
    price_list_id, product_id, unit_price, valid_from, note, created_by_email
  )
  VALUES (
    _list_id, _product_id, _new_price, now(), _note, user_email
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- 12. Trigger: prevent deletion of price list with associated sales
CREATE OR REPLACE FUNCTION public.prevent_delete_pricelist_with_sales()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only check if sales table already has price_list_id column (after migration 2)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'price_list_id'
  ) THEN
    IF EXISTS (SELECT 1 FROM public.sales WHERE price_list_id = OLD.id) THEN
      RAISE EXCEPTION 'pricelist_in_use'
        USING MESSAGE = 'No se puede eliminar: la lista de precios tiene ventas asociadas';
    END IF;
  END IF;

  IF OLD.is_system THEN
    RAISE EXCEPTION 'pricelist_is_system'
      USING MESSAGE = 'No se puede eliminar una lista de precios del sistema';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_delete_pricelist ON public.price_lists;
CREATE TRIGGER trg_prevent_delete_pricelist
  BEFORE DELETE ON public.price_lists
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_pricelist_with_sales();