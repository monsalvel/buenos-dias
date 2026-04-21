CREATE OR REPLACE FUNCTION public.set_product_price(_list_id uuid, _product_id uuid, _new_price numeric, _note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  new_id UUID;
  user_email TEXT;
  current_active_id UUID;
  current_active_price NUMERIC;
BEGIN
  -- Auth guard: block unauthenticated callers
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized'
      USING MESSAGE = 'Autenticación requerida';
  END IF;

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

  SELECT id, unit_price INTO current_active_id, current_active_price
  FROM public.price_list_prices
  WHERE price_list_id = _list_id
    AND product_id = _product_id
    AND valid_to IS NULL
  ORDER BY valid_from DESC
  LIMIT 1;

  IF current_active_id IS NOT NULL AND current_active_price = _new_price THEN
    RETURN current_active_id;
  END IF;

  IF current_active_id IS NOT NULL THEN
    UPDATE public.price_list_prices
    SET valid_to = now()
    WHERE id = current_active_id;
  END IF;

  INSERT INTO public.price_list_prices (
    price_list_id, product_id, unit_price, valid_from, note, created_by_email
  )
  VALUES (
    _list_id, _product_id, _new_price, now(), _note, user_email
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

-- Defense in depth: revoke execute from anonymous role
REVOKE EXECUTE ON FUNCTION public.set_product_price(uuid, uuid, numeric, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_product_price(uuid, uuid, numeric, text) FROM public;
GRANT EXECUTE ON FUNCTION public.set_product_price(uuid, uuid, numeric, text) TO authenticated;