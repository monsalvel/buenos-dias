-- Tabla de lotes de stock
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  quantity_received INTEGER NOT NULL DEFAULT 0,
  quantity_remaining INTEGER NOT NULL DEFAULT 0,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_batches_product ON public.product_batches(product_id, received_at);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage product_batches"
ON public.product_batches
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger: mantener products.stock = SUM(quantity_remaining)
CREATE OR REPLACE FUNCTION public.sync_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  pid UUID;
  total INTEGER;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  SELECT COALESCE(SUM(quantity_remaining), 0) INTO total
  FROM public.product_batches WHERE product_id = pid;
  UPDATE public.products SET stock = total WHERE id = pid;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_product_stock
AFTER INSERT OR UPDATE OR DELETE ON public.product_batches
FOR EACH ROW EXECUTE FUNCTION public.sync_product_stock();

-- Función FIFO: consume `qty` unidades de los lotes más antiguos.
-- Devuelve el costo unitario promedio real consumido.
-- Si no hay stock suficiente, consume lo disponible y el resto al costo del producto.
CREATE OR REPLACE FUNCTION public.consume_stock_fifo(_product_id UUID, _qty INTEGER)
RETURNS NUMERIC
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  remaining INTEGER := _qty;
  total_cost NUMERIC := 0;
  consumed INTEGER := 0;
  batch RECORD;
  take INTEGER;
  fallback_cost NUMERIC;
BEGIN
  IF _qty <= 0 THEN RETURN 0; END IF;

  FOR batch IN
    SELECT id, quantity_remaining, unit_cost
    FROM public.product_batches
    WHERE product_id = _product_id AND quantity_remaining > 0
    ORDER BY received_at ASC, created_at ASC
    FOR UPDATE
  LOOP
    EXIT WHEN remaining <= 0;
    take := LEAST(batch.quantity_remaining, remaining);
    UPDATE public.product_batches
       SET quantity_remaining = quantity_remaining - take
     WHERE id = batch.id;
    total_cost := total_cost + (take * batch.unit_cost);
    consumed := consumed + take;
    remaining := remaining - take;
  END LOOP;

  -- Si no había stock suficiente, completar con costo del producto
  IF remaining > 0 THEN
    SELECT cost INTO fallback_cost FROM public.products WHERE id = _product_id;
    total_cost := total_cost + (remaining * COALESCE(fallback_cost, 0));
    consumed := consumed + remaining;
  END IF;

  IF consumed = 0 THEN RETURN 0; END IF;
  RETURN total_cost / consumed;
END;
$$;