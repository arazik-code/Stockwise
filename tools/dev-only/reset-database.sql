-- DANGER: this script TRUNCATEs the entire database. Dev/test use only.
-- Never run this against the live StockManagement database.
-- Moved here from repo root during the Phase 0 safety audit (was previously
-- sitting one click away from psql -f in the repo root next to real ops scripts).

-- Full database reset for StockManagement
-- TRUNCATE CASCADE handles all foreign key dependencies automatically

TRUNCATE TABLE
  "ReceiptBarcodes",
  "ExchangeItems",
  "RefundItems",
  "Refunds",
  "LoyaltyTransactions",
  "SaleItems",
  "Sales",
  "StockMovements",
  "StockItems",
  "InvoicePayments",
  "InvoiceLineItems",
  "Invoices",
  "ShopifyOrderLineItems",
  "ShopifyProducts",
  "ShopifyOrders",
  "ProductVariants",
  "Products",
  "Fournisseurs",
  "Colors",
  "Sizes",
  "Clients",
  "Categories",
  "FailedWebhooks",
  "Users"
CASCADE;

-- Reset all sequences to 1
ALTER SEQUENCE "Users_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Categories_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Fournisseurs_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Products_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Colors_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Sizes_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "ProductVariants_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "StockItems_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "StockMovements_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Sales_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "SaleItems_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "ShopifyOrders_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "ShopifyOrderLineItems_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "ShopifyProducts_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Clients_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "LoyaltyTransactions_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "FailedWebhooks_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Invoices_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "InvoiceLineItems_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "InvoicePayments_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "Refunds_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "RefundItems_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "ExchangeItems_Id_seq" RESTART WITH 1;
ALTER SEQUENCE "ReceiptBarcodes_Id_seq" RESTART WITH 1;
