
CREATE TABLE public.store_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone text NOT NULL DEFAULT '',
  bank text NOT NULL DEFAULT '',
  cedula text NOT NULL DEFAULT '',
  store_name text NOT NULL DEFAULT 'Buenos Días',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on store_settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);

-- Insert default row
INSERT INTO public.store_settings (phone, bank, cedula, store_name) VALUES ('', '', '', 'Buenos Días');
