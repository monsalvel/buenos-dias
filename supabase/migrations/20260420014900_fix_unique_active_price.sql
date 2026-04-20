-- Garantiza un solo precio activo (valid_to IS NULL) por producto por lista a nivel DB.
-- Previene race conditions si dos peticiones concurrentes intentan crear precios al mismo tiempo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_plp_one_active_per_product
ON public.price_list_prices (price_list_id, product_id)
WHERE valid_to IS NULL;
