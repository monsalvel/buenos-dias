
Adopto tu contraplan casi tal cual: es más simple, más seguro y se integra mejor con el código actual. Incluyo dos correcciones puntuales.

## Correcciones al contraplan

1. **Sí hay autenticación**: el proyecto tiene `useAuth.tsx`, `Auth.tsx`, `ProtectedRoute` y todas las RLS usan `TO authenticated`. Por eso las RLS propuestas (`TO authenticated USING (true)`) son correctas. Sin embargo, **NO añadiré roles `admin/seller` por ahora** (coincido contigo: hoy todo usuario logueado es operador único). Dejo la puerta abierta para roles en una iteración futura.
2. **Autor del cambio**: en lugar de pasar `_author_name` desde el frontend (manipulable), usaré `auth.email()` dentro de la RPC `set_product_price` para registrar quién hizo el cambio de precio de forma confiable.

## Plan adoptado (resumen)

### Base de datos (2 migraciones)

**Migración 1 — esquema:**
- Tablas: `price_lists` (code, name, kind 'sale'|'cost', currency, is_system) y `price_list_prices` (SCD Type 2: `valid_from`/`valid_to`, `unit_price`, `note`, `created_by_email`).
- Seed idempotente: `LISTA_PRECIO_VENTA_USD` y `LISTA_PRECIO_COSTO_USD` (`is_system=true`).
- Backfill: insertar precios actuales de productos activos en ambas listas.
- Función `get_active_price(list_id, product_id, at)` (STABLE).
- RPC `set_product_price(list_id, product_id, new_price, note)` que cierra la versión vigente y crea una nueva. Toma `created_by_email` desde `auth.jwt()`.
- Trigger `prevent_delete_pricelist_with_sales` (BEFORE DELETE).
- Vista `active_prices` + 3 índices (lookup, parcial activos, sales.price_list_id).
- RLS: `TO authenticated` ALL en ambas tablas.

**Migración 2 — sales:**
- `ALTER TABLE sales ADD COLUMN price_list_id UUID REFERENCES price_lists(id)` nullable → UPDATE asigna `LISTA_PRECIO_VENTA_USD` a ventas históricas → `SET NOT NULL`. `sale_items.unit_price/unit_cost` no se tocan (preserva contabilidad).

### Frontend

**Tipos (`src/types/index.ts`):** `PriceList`, `PriceListPrice`, `PriceListKind`. `Sale.priceListId`. `TabId += 'price-lists'`.

**Store (`src/store/useStore.ts`):**
- Estado: `priceLists`, `activePrices: Map<listId, Map<productId, number>>` (lookup O(1), sin historial en memoria).
- Acciones: `fetchPriceLists` (lazy), `setProductPrice` (vía RPC), `getActivePrice`, `fetchPriceHistory` (on-demand).
- `addSale`: persiste `price_list_id`.
- `updateProduct`: si cambió `price` o `cost`, llama `set_product_price` para la lista correspondiente y refresca `activePrices`.

**UI:**
- `PriceListsPage.tsx` (nuevo): cards con las 2 listas → tabla productos con precio vigente, "Editar precio" (dialog con nota opcional, soporte USD/Bs igual que `ProductForm`), "Ver historial" (timeline). Botón eliminar deshabilitado en listas `is_system`.
- `SalesPage.tsx → NewSaleForm`: `<Select>` obligatorio "Lista de precio" (default Venta USD) arriba de productos. Productos sin precio en la lista → botón deshabilitado "Sin precio". Items ya agregados NO se re-precian (warning si cambias con carrito).
- `ProductsPage.tsx`: nota informativa bajo el formulario.
- `BottomNav.tsx`: nueva entrada "Listas de Precios" (icono `ListOrdered`) en el sheet "Más".
- `Index.tsx`: registrar `PriceListsPage` en el router de tabs.

### Robustez
- `getActivePrice` retorna `number | null`; UI maneja el null.
- Error `pricelist_in_use` se traduce a toast en español.
- Toda mutación de precios pasa por la RPC (un único punto de validación).
- Sin triggers automáticos en `products` → control explícito desde el código (evita versiones fantasma por redondeos).

### Orden de implementación
1. Migración DB #1 (esquema + seed + RPC + trigger + RLS).
2. Migración DB #2 (`sales.price_list_id`).
3. Tipos.
4. Store.
5. `PriceListsPage`.
6. `NewSaleForm` con selector.
7. `ProductsPage` (nota + llamar RPC en `updateProduct`).
8. `BottomNav` + `Index.tsx`.
