-- CUSTOMERS
ALTER TABLE public.customers
  ADD CONSTRAINT customers_first_name_len CHECK (char_length(first_name) BETWEEN 1 AND 100),
  ADD CONSTRAINT customers_last_name_len  CHECK (char_length(last_name)  <= 100),
  ADD CONSTRAINT customers_phone_len      CHECK (char_length(phone) <= 20),
  ADD CONSTRAINT customers_address_len    CHECK (address IS NULL OR char_length(address) <= 500),
  ADD CONSTRAINT customers_total_spent_nonneg     CHECK (total_spent >= 0),
  ADD CONSTRAINT customers_total_purchases_nonneg CHECK (total_purchases >= 0);

-- PRODUCTS
ALTER TABLE public.products
  ADD CONSTRAINT products_name_len        CHECK (char_length(name) BETWEEN 1 AND 200),
  ADD CONSTRAINT products_description_len CHECK (description IS NULL OR char_length(description) <= 1000),
  ADD CONSTRAINT products_category_len    CHECK (char_length(category) <= 50),
  ADD CONSTRAINT products_price_nonneg    CHECK (price >= 0),
  ADD CONSTRAINT products_cost_nonneg     CHECK (cost  >= 0),
  ADD CONSTRAINT products_stock_nonneg    CHECK (stock >= 0);

-- PRODUCT BATCHES
ALTER TABLE public.product_batches
  ADD CONSTRAINT batches_unit_cost_nonneg          CHECK (unit_cost >= 0),
  ADD CONSTRAINT batches_qty_received_nonneg       CHECK (quantity_received >= 0),
  ADD CONSTRAINT batches_qty_remaining_nonneg      CHECK (quantity_remaining >= 0),
  ADD CONSTRAINT batches_qty_remaining_le_received CHECK (quantity_remaining <= quantity_received),
  ADD CONSTRAINT batches_note_len                  CHECK (note IS NULL OR char_length(note) <= 500);

-- SALES
ALTER TABLE public.sales
  ADD CONSTRAINT sales_total_nonneg       CHECK (total >= 0),
  ADD CONSTRAINT sales_total_cost_nonneg  CHECK (total_cost >= 0),
  ADD CONSTRAINT sales_amount_paid_nonneg CHECK (amount_paid >= 0),
  ADD CONSTRAINT sales_customer_name_len  CHECK (char_length(customer_name) BETWEEN 1 AND 200),
  ADD CONSTRAINT sales_seller_name_len    CHECK (char_length(seller_name) <= 100);

-- SALE ITEMS
ALTER TABLE public.sale_items
  ADD CONSTRAINT sale_items_qty_positive       CHECK (quantity > 0),
  ADD CONSTRAINT sale_items_unit_price_nonneg  CHECK (unit_price >= 0),
  ADD CONSTRAINT sale_items_unit_cost_nonneg   CHECK (unit_cost  >= 0),
  ADD CONSTRAINT sale_items_subtotal_nonneg    CHECK (subtotal   >= 0),
  ADD CONSTRAINT sale_items_product_name_len   CHECK (char_length(product_name) BETWEEN 1 AND 200);

-- PAYMENTS
ALTER TABLE public.payments
  ADD CONSTRAINT payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT payments_note_len        CHECK (note IS NULL OR char_length(note) <= 500);

-- BATCH PAYMENTS
ALTER TABLE public.batch_payments
  ADD CONSTRAINT batch_payments_amount_positive CHECK (amount > 0),
  ADD CONSTRAINT batch_payments_method_len      CHECK (char_length(method) BETWEEN 1 AND 30),
  ADD CONSTRAINT batch_payments_note_len        CHECK (note IS NULL OR char_length(note) <= 500);

-- PRICE LISTS
ALTER TABLE public.price_lists
  ADD CONSTRAINT price_lists_name_len CHECK (char_length(name) BETWEEN 1 AND 100),
  ADD CONSTRAINT price_lists_code_len CHECK (char_length(code) BETWEEN 1 AND 50);

ALTER TABLE public.price_list_prices
  ADD CONSTRAINT plp_unit_price_nonneg CHECK (unit_price >= 0),
  ADD CONSTRAINT plp_note_len          CHECK (note IS NULL OR char_length(note) <= 500);

-- TRIGGER: validate sale amounts (balance auto-computed, no overpayment)
CREATE OR REPLACE FUNCTION public.validate_sale_amounts()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.amount_paid > NEW.total THEN
    RAISE EXCEPTION 'invalid_amount_paid'
      USING MESSAGE = 'El monto pagado no puede exceder el total de la venta';
  END IF;
  NEW.balance := NEW.total - NEW.amount_paid;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_sale_amounts ON public.sales;
CREATE TRIGGER trg_validate_sale_amounts
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.validate_sale_amounts();

-- TRIGGER: prevent batch payment overpayment
CREATE OR REPLACE FUNCTION public.validate_batch_payment()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  total_cost NUMERIC;
  already_paid NUMERIC;
BEGIN
  SELECT (unit_cost * quantity_received) INTO total_cost
  FROM public.product_batches WHERE id = NEW.batch_id;

  IF total_cost IS NULL THEN
    RAISE EXCEPTION 'batch_not_found' USING MESSAGE = 'Lote no encontrado';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO already_paid
  FROM public.batch_payments
  WHERE batch_id = NEW.batch_id
    AND (TG_OP = 'INSERT' OR id <> NEW.id);

  IF (already_paid + NEW.amount) > total_cost THEN
    RAISE EXCEPTION 'overpayment'
      USING MESSAGE = 'El pago excede el costo total del lote';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_batch_payment ON public.batch_payments;
CREATE TRIGGER trg_validate_batch_payment
BEFORE INSERT OR UPDATE ON public.batch_payments
FOR EACH ROW EXECUTE FUNCTION public.validate_batch_payment();