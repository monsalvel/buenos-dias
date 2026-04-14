# Project Memory

## Core
Bakery sales/CRM app. Spanish UI. Warm amber/cream theme. Playfair Display headings, DM Sans body.
Zustand store connected to Supabase (Lovable Cloud). Mobile-first with bottom nav.
DB tables: products, customers, sales, sale_items, payments, bcv_rates. RLS permissive (no auth yet).
Sales include seller_name field. BCV rate fetched via edge function from BDV JSON API.

## Memories
- [Design tokens](mem://design/tokens) — Warm bakery palette: amber primary, cream bg, brown accent, success/warning/destructive
- [App features](mem://features/core) — Sales with credit/payments, CRM with WhatsApp, product catalog, dashboard analytics
- [Database schema](mem://features/database) — Supabase tables: products, customers, sales, sale_items, payments, bcv_rates with enums sale_status and payment_method
