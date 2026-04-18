
## Plan

### 1. Auth — Spanish messages + remove signup
- `src/pages/Auth.tsx`: remove the `<Tabs>` (no "Crear cuenta" tab), keep only the Sign-In form. Add a Spanish translation map for common Supabase auth errors (e.g. `"Password is known to be weak..." → "La contraseña es muy débil, elige otra más segura"`, `"Email not confirmed" → "Correo no verificado"`, `"Invalid login credentials" → "Credenciales incorrectas"`, etc.). Helper `translateAuthError(message)` used in all toasts.

### 2. Stock batches — separate margins per batch (NEW concept: "Lotes de stock")
**Idea:** Each time the owner adds inventory, the unit cost may change (supplier price varies). Instead of overwriting the product's cost, we store **batches (lotes)** with their own `cost`, `quantity_received`, `quantity_remaining`, `received_at`. Sales consume stock **FIFO** (oldest batch first), recording the actual `unit_cost` of the batch consumed in `sale_items.unit_cost`. This way:
- Profit on old vs new stock is preserved exactly (you see the real margin per batch).
- A new "Historial de lotes" view per product shows: batch date, cost, units received, units remaining, units sold, revenue generated, profit.

**DB migration:**
```sql
CREATE TABLE product_batches (
  id uuid PK, product_id uuid, unit_cost numeric,
  quantity_received int, quantity_remaining int,
  received_at timestamptz default now(), note text
);
-- RLS: authenticated only (ALL).
```
Add helper SQL function `consume_stock_fifo(product_id, qty)` that returns the weighted unit_cost actually consumed and decrements batches.

**Code:**
- `StockPage.tsx`: replace the simple "+/-" with a richer flow. The "+" opens a dialog asking **Cantidad + Costo unitario de este lote** (defaults to product's last cost) → creates a new `product_batches` row. The "-" only used for shrinkage/manual correction (consumes FIFO).
- New collapsible per product showing batch history with: fecha, costo, recibidos, vendidos, restantes, ganancia generada (`(unit_price_sold - batch_cost) * sold`).
- `useStore.ts`: add `batches` state, `addBatch`, `adjustBatch`, and update `addSale` to call FIFO consumption so `sale_items.unit_cost` reflects the real batch cost (mix of batches if needed → split into multiple sale_items or weighted average).
- `Product.stock` becomes a derived sum of `quantity_remaining` (kept in sync via trigger or recomputed on the fly).

### 3. Earnings analysis — pro charts (Recharts already installed)
Redesign `EarningsDetail.tsx` with 4 sections in tabs (`Tabs` from shadcn): **Resumen / Tendencia / Productos / Lotes**.
- **Resumen**: keep summary cards + margin gauge.
- **Tendencia**: `AreaChart` (Recharts) — daily revenue vs cost vs profit for last 30 days, stacked smooth gradient.
- **Productos**: horizontal `BarChart` of top-10 products by profit + a `PieChart` of revenue share.
- **Lotes**: table comparing margin per batch (old stock vs new stock) — the key visual proof of requirement #3.
Use the existing `ChartContainer` wrapper from `src/components/ui/chart.tsx` for styling consistency.

### 4. Bottom navigation — clean, non-overwhelming
6 icons is too many. New design:
- Keep **4 primary tabs** in the bottom bar: **Inicio · Ventas · Clientes · Más**.
- "Más" opens a bottom `Sheet` (drawer) with secondary items: **Productos, Stock, Ajustes** (and room to grow). Each as a large tap-friendly row with icon + label + short description.
- Active tab uses a soft pill background (rounded-full bg-primary/10) instead of just a color change — more iOS-like.
- Add subtle top hairline + safe-area padding (`pb-[env(safe-area-inset-bottom)]`).
- File: rewrite `src/components/BottomNav.tsx`; the "Más" sheet lives inside the same component.

### Files touched
- `src/pages/Auth.tsx` (rewrite — sign-in only + ES translations)
- `supabase/migrations/...` (new `product_batches` table + FIFO function + RLS)
- `src/types/index.ts` (add `ProductBatch`)
- `src/store/useStore.ts` (batches state, addBatch, FIFO sale consumption)
- `src/components/StockPage.tsx` (batch-aware UI + history)
- `src/components/EarningsDetail.tsx` (Recharts tabs)
- `src/components/BottomNav.tsx` (4 tabs + "Más" sheet)
- `src/pages/Index.tsx` (TabId routing still works — just driven from the sheet for secondary tabs)

### Order of implementation
1. Auth cleanup (small, isolated).
2. DB migration for batches.
3. Store + Stock batch flow.
4. Earnings charts.
5. Bottom nav redesign.
