-- Tabla de pagos a proveedor por lote
CREATE TABLE public.batch_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.product_batches(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'efectivo',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note TEXT,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_batch_payments_batch ON public.batch_payments(batch_id);
CREATE INDEX idx_batch_payments_paid_at ON public.batch_payments(paid_at DESC);

ALTER TABLE public.batch_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage batch_payments"
  ON public.batch_payments
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
