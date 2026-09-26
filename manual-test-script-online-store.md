# Manual Test Script — Online Store Module
## Stock Management System

**Document Version:** 1.0
**Date:** 2026-07-29
**Module:** Online Store
**Environment:** Staging / Production
**Browser:** Chrome (latest), Firefox (latest), Edge (latest)

---

## Table of Contents

1. [Authentication & Access Control](#1-authentication--access-control)
2. [Dashboard](#2-dashboard)
3. [Orders Management](#3-orders-management)
4. [Products & Shopify Mapping](#4-products--shopify-mapping)
5. [Clients CRM](#5-clients-crm)
6. [CRM Analytics](#6-crm-analytics)
7. [Delivery (OzonExpress)](#7-delivery-ozonexpress)
8. [Finance (COD)](#8-finance-cod)
9. [Order Confirmation Queue](#9-order-confirmation-queue)
10. [Sync & Conflict Resolution](#10-sync--conflict-resolution)
11. [Variant Linking](#11-variant-linking)
12. [Settings](#12-settings)
13. [WhatsApp Integration](#13-whatsapp-integration)
14. [Printer / Packing Slip](#14-printer--packing-slip)
15. [Search, Filter & Pagination](#15-search-filter--pagination)
16. [Error Handling & Edge Cases](#16-error-handling--edge-cases)

---

## 1. Authentication & Access Control

### TC-AUTH-001 — Login with valid credentials

| Field | Value |
|---|---|
| **Pre-conditions** | User has an active account. Browser is open at `/login`. |
| **Steps** | 1. Navigate to `/login`.<br>2. Enter valid email and password.<br>3. Click "Login" / submit the form. |
| **Expected result** | User is redirected to `/online` (Dashboard). Auth token is stored. Navigation menu is visible. |
| **Pass/Fail** | |

---

### TC-AUTH-002 — Login with invalid credentials

| Field | Value |
|---|---|
| **Pre-conditions** | Browser is open at `/login`. |
| **Steps** | 1. Navigate to `/login`.<br>2. Enter invalid email or wrong password.<br>3. Click "Login". |
| **Expected result** | Error message is displayed (e.g., "Invalid email or password"). User remains on `/login`. No token is stored. |
| **Pass/Fail** | |

---

### TC-AUTH-003 — Login with empty fields

| Field | Value |
|---|---|
| **Pre-conditions** | Browser is open at `/login`. |
| **Steps** | 1. Navigate to `/login`.<br>2. Leave email and password fields empty.<br>3. Click "Login". |
| **Expected result** | Form validation errors appear (e.g., "Email is required", "Password is required"). No request is sent. |
| **Pass/Fail** | |

---

### TC-AUTH-004 — Access protected route without authentication

| Field | Value |
|---|---|
| **Pre-conditions** | User is NOT logged in. No auth token in browser. |
| **Steps** | 1. Navigate directly to `/online/orders`. |
| **Expected result** | User is redirected to `/login`. Protected page is not rendered. |
| **Pass/Fail** | |

---

### TC-AUTH-005 — Access protected route with expired token

| Field | Value |
|---|---|
| **Pre-conditions** | User was logged in but token has expired (manually expire or wait). |
| **Steps** | 1. While token is expired, navigate to `/online/products`. |
| **Expected result** | User is redirected to `/login` with an appropriate message (e.g., "Session expired, please log in again"). |
| **Pass/Fail** | |

---

### TC-AUTH-006 — Logout

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in and on any page. |
| **Steps** | 1. Click the logout button/link (usually in header or profile menu). |
| **Expected result** | Auth token is cleared. User is redirected to `/login`. Navigating back to `/online` redirects to `/login`. |
| **Pass/Fail** | |

---

### TC-AUTH-007 — Token refresh / renewal

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Token is close to expiry but not yet expired. |
| **Steps** | 1. Perform an action that triggers an API call (e.g., navigate to a page). |
| **Expected result** | Token is silently refreshed if refresh mechanism exists. User session continues without interruption. |
| **Pass/Fail** | |

---

### TC-AUTH-008 — Multiple tabs session consistency

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in with two tabs open on the same app. |
| **Steps** | 1. In Tab A, log out.<br>2. In Tab B, attempt to navigate to any page. |
| **Expected result** | Tab B also reflects the logged-out state. No stale authenticated views are shown. |
| **Pass/Fail** | |

---

## 2. Dashboard

### TC-DASH-001 — Dashboard loads correctly after login

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online`. |
| **Steps** | 1. Navigate to `/online`.<br>2. Wait for page to fully load. |
| **Expected result** | Dashboard page renders. All KPI cards (total orders, revenue, pending, etc.) are visible. Charts load with data or show "No data" placeholder. No console errors. |
| **Pass/Fail** | |

---

### TC-DASH-002 — KPI cards display correct data

| Field | Value |
|---|---|
| **Pre-conditions** | Dashboard is loaded. Known test data exists in the system. |
| **Steps** | 1. Note the values on each KPI card.<br>2. Cross-reference with the actual database/API values for the same period. |
| **Expected result** | KPI values match the source data. Numbers are formatted correctly (currency symbols, comma separators). |
| **Pass/Fail** | |

---

### TC-DASH-003 — Dashboard date range filter

| Field | Value |
|---|---|
| **Pre-conditions** | Dashboard is loaded. Date range picker is present. |
| **Steps** | 1. Select a custom date range (e.g., last 7 days).<br>2. Wait for data to reload. |
| **Expected result** | All KPI cards and charts update to reflect the selected date range. Loading indicator appears during fetch. |
| **Pass/Fail** | |

---

### TC-DASH-004 — Dashboard charts render

| Field | Value |
|---|---|
| **Pre-conditions** | Dashboard is loaded. |
| **Steps** | 1. Scroll to the charts section.<br>2. Hover over data points on each chart. |
| **Expected result** | Charts render correctly with axes, labels, and data points. Tooltips appear on hover showing exact values. |
| **Pass/Fail** | |

---

### TC-DASH-005 — Dashboard responsive layout

| Field | Value |
|---|---|
| **Pre-conditions** | Dashboard is loaded. |
| **Steps** | 1. Resize browser window to mobile width (< 768px).<br>2. Resize to tablet width (768px–1024px).<br>3. Resize to desktop (> 1024px). |
| **Expected result** | Layout adjusts responsively. KPI cards stack vertically on mobile. Charts resize appropriately. No horizontal overflow. |
| **Pass/Fail** | |

---

### TC-DASH-006 — Dashboard auto-refresh

| Field | Value |
|---|---|
| **Pre-conditions** | Dashboard is loaded. Auto-refresh interval is set (if applicable). |
| **Steps** | 1. Leave the dashboard open for the auto-refresh duration.<br>2. Observe if data updates. |
| **Expected result** | Data refreshes automatically without manual page reload. No flicker or layout jump. |
| **Pass/Fail** | |

---

## 3. Orders Management

### TC-ORD-001 — Orders list page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/orders`. |
| **Steps** | 1. Navigate to `/online/orders`.<br>2. Wait for page to load. |
| **Expected result** | Orders list/table is displayed. Columns include order ID, customer name, status, date, total. Status badges are color-coded. |
| **Pass/Fail** | |

---

### TC-ORD-002 — Create new order

| Field | Value |
|---|---|
| **Pre-conditions** | User is on `/online/orders`. At least one product exists in the catalog. |
| **Steps** | 1. Click "New Order" / "Create Order" button.<br>2. Fill in customer name, phone, address.<br>3. Add a product (select from dropdown or search).<br>4. Set quantity.<br>5. Confirm order total is calculated correctly.<br>6. Click "Save" / "Create". |
| **Expected result** | Success message is displayed. Order appears in the list with status "Pending" or equivalent. Order detail page opens or user is redirected to the list. |
| **Pass/Fail** | |

---

### TC-ORD-003 — Create order with missing required fields

| Field | Value |
|---|---|
| **Pre-conditions** | User is on the order creation form. |
| **Steps** | 1. Leave customer name empty.<br>2. Leave product unselected.<br>3. Click "Save". |
| **Expected result** | Validation errors appear for each required field. Order is not created. |
| **Pass/Fail** | |

---

### TC-ORD-004 — View order detail

| Field | Value |
|---|---|
| **Pre-conditions** | At least one order exists in the list. |
| **Steps** | 1. Click on an order row / order ID in the list. |
| **Expected result** | Order detail page opens showing: customer info, product(s), quantities, prices, status, dates, notes, and action buttons. |
| **Pass/Fail** | |

---

### TC-ORD-005 — Edit order

| Field | Value |
|---|---|
| **Pre-conditions** | User is on order detail page. Order is in an editable status. |
| **Steps** | 1. Click "Edit".<br>2. Change quantity or add/remove a product.<br>3. Click "Save". |
| **Expected result** | Changes are saved. Order total updates. Success message is displayed. |
| **Pass/Fail** | |

---

### TC-ORD-006 — Advance order status

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists with status "Pending". |
| **Steps** | 1. Open the order detail.<br>2. Click the next status button (e.g., "Confirm" / "Process").<br>3. Confirm the status change if prompted. |
| **Expected result** | Order status updates to the next stage (e.g., "Confirmed"). Status badge color changes. Status change is logged in the order history/timeline. |
| **Pass/Fail** | |

---

### TC-ORD-007 — Cancel order

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists and is not in a final state (e.g., not yet delivered). |
| **Steps** | 1. Open the order detail.<br>2. Click "Cancel Order".<br>3. Confirm cancellation when prompted. |
| **Expected result** | Order status changes to "Cancelled". Confirmation dialog is shown before action. Cancelled order is still visible in the list (with appropriate filter). |
| **Pass/Fail** | |

---

### TC-ORD-008 — Mark order as paid

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists and is unpaid. |
| **Steps** | 1. Open the order detail.<br>2. Click "Mark as Paid".<br>3. Select payment method if prompted.<br>4. Confirm. |
| **Expected result** | Order is marked as paid. Payment badge/status updates. If COD, this may affect finance records. |
| **Pass/Fail** | |

---

### TC-ORD-009 — Delete order

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists with status that allows deletion (e.g., Cancelled or Draft). |
| **Steps** | 1. Open the order detail or select from list.<br>2. Click "Delete".<br>3. Confirm deletion. |
| **Expected result** | Order is removed from the list. Success message is displayed. Order cannot be accessed via direct URL after deletion. |
| **Pass/Fail** | |

---

### TC-ORD-010 — Order list search

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple orders exist in the list. |
| **Steps** | 1. Type a known customer name or order ID in the search box.<br>2. Wait for results. |
| **Expected result** | List filters to show only matching orders. Search is responsive (debounced). Clearing search restores full list. |
| **Pass/Fail** | |

---

### TC-ORD-011 — Order list filter by status

| Field | Value |
|---|---|
| **Pre-conditions** | Orders with various statuses exist. |
| **Steps** | 1. Select a specific status from the filter dropdown (e.g., "Pending").<br>2. Observe the list. |
| **Expected result** | Only orders with the selected status are shown. Filter badge/chip is displayed. |
| **Pass/Fail** | |

---

### TC-ORD-012 — Order list pagination

| Field | Value |
|---|---|
| **Pre-conditions** | More orders exist than the page size (e.g., > 20 or > 50). |
| **Steps** | 1. Scroll to the bottom of the list.<br>2. Click "Next" or page number 2. |
| **Expected result** | Second page of orders loads. Page indicator updates. Previous page button works. |
| **Pass/Fail** | |

---

### TC-ORD-013 — Order list date range filter

| Field | Value |
|---|---|
| **Pre-conditions** | Orders from different dates exist. |
| **Steps** | 1. Select a date range (e.g., last 7 days).<br>2. Wait for list to update. |
| **Expected result** | Only orders within the selected date range are displayed. |
| **Pass/Fail** | |

---

### TC-ORD-014 — Order notes / internal comments

| Field | Value |
|---|---|
| **Pre-conditions** | User is on order detail page. |
| **Steps** | 1. Add a note in the notes field.<br>2. Save the note. |
| **Expected result** | Note is saved and displayed in the order timeline/history. Note includes timestamp and author. |
| **Pass/Fail** | |

---

### TC-ORD-015 — Order status history / timeline

| Field | Value |
|---|---|
| **Pre-conditions** | Order has been through multiple status changes. |
| **Steps** | 1. Open order detail.<br>2. Scroll to status history/timeline section. |
| **Expected result** | All status changes are listed chronologically with timestamps and the user who performed the change. |
| **Pass/Fail** | |

---

## 4. Products & Shopify Mapping

### TC-PROD-001 — Products list page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/products`. |
| **Steps** | 1. Navigate to `/online/products`.<br>2. Wait for page to load. |
| **Expected result** | Products table is displayed. Columns include product name, SKU, price, stock, Shopify status, actions. |
| **Pass/Fail** | |

---

### TC-PROD-002 — Add new product

| Field | Value |
|---|---|
| **Pre-conditions** | User is on `/online/products`. |
| **Steps** | 1. Click "Add Product".<br>2. Fill in name, SKU, price, description.<br>3. Upload an image (if supported).<br>4. Click "Save". |
| **Expected result** | Product is created and appears in the list. Success message is shown. |
| **Pass/Fail** | |

---

### TC-PROD-003 — Edit existing product

| Field | Value |
|---|---|
| **Pre-conditions** | At least one product exists. |
| **Steps** | 1. Click edit icon/button on a product row.<br>2. Change the product name or price.<br>3. Click "Save". |
| **Expected result** | Changes are saved. Product details are updated in the list. |
| **Pass/Fail** | |

---

### TC-PROD-004 — Delete product

| Field | Value |
|---|---|
| **Pre-conditions** | Product exists and is not linked to active orders (or deletion is allowed). |
| **Steps** | 1. Click delete icon/button on a product row.<br>2. Confirm deletion. |
| **Expected result** | Product is removed from the list. Confirmation dialog is shown. |
| **Pass/Fail** | |

---

### TC-PROD-005 — Map product to Shopify variant

| Field | Value |
|---|---|
| **Pre-conditions** | Product exists locally. Shopify integration is configured. Shopify products/variants are available. |
| **Steps** | 1. Open product detail or mapping section.<br>2. Click "Map to Shopify" or similar.<br>3. Search/select the corresponding Shopify product/variant.<br>4. Save the mapping. |
| **Expected result** | Mapping is saved. Shopify variant ID is associated with the local product. Mapping indicator shows "Linked" or green status. |
| **Pass/Fail** | |

---

### TC-PROD-006 — Remove Shopify mapping

| Field | Value |
|---|---|
| **Pre-conditions** | Product is currently mapped to a Shopify variant. |
| **Steps** | 1. Open product mapping.<br>2. Click "Unlink" / "Remove mapping".<br>3. Confirm. |
| **Expected result** | Mapping is removed. Shopify variant association is cleared. Status shows "Unlinked". |
| **Pass/Fail** | |

---

### TC-PROD-007 — Product search

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple products exist. |
| **Steps** | 1. Type a product name or SKU in the search bar. |
| **Expected result** | List filters in real-time to show matching products. |
| **Pass/Fail** | |

---

### TC-PROD-008 — Product list pagination

| Field | Value |
|---|---|
| **Pre-conditions** | More products than page size exist. |
| **Steps** | 1. Navigate to page 2.<br>2. Navigate back to page 1. |
| **Expected result** | Pagination works correctly. Page indicator is accurate. |
| **Pass/Fail** | |

---

### TC-PROD-009 — Product image upload

| Field | Value |
|---|---|
| **Pre-conditions** | User is on product creation/edit form. Image upload is supported. |
| **Steps** | 1. Click image upload area.<br>2. Select a valid image file (JPG, PNG).<br>3. Wait for upload to complete. |
| **Expected result** | Image preview is shown after upload. Image is saved with the product. |
| **Pass/Fail** | |

---

### TC-PROD-010 — Product image upload — invalid file type

| Field | Value |
|---|---|
| **Pre-conditions** | User is on product creation/edit form. |
| **Steps** | 1. Attempt to upload a .txt or .exe file. |
| **Expected result** | Error message is shown (e.g., "Invalid file type. Allowed: JPG, PNG"). File is not uploaded. |
| **Pass/Fail** | |

---

### TC-PROD-011 — Product stock sync status indicator

| Field | Value |
|---|---|
| **Pre-conditions** | Products with Shopify mapping exist. |
| **Steps** | 1. View the products list.<br>2. Check the sync status column for each product. |
| **Expected result** | Each product shows a sync status (Synced, Out of Sync, Error). Status is accurate per the last sync run. |
| **Pass/Fail** | |

---

## 5. Clients CRM

### TC-CLI-001 — Client list page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/clients`. |
| **Steps** | 1. Navigate to `/online/clients`.<br>2. Wait for page to load. |
| **Expected result** | Client list/table is displayed. Columns include name, phone, email, city, order count, segment, last order date. |
| **Pass/Fail** | |

---

### TC-CLI-002 — Add new client

| Field | Value |
|---|---|
| **Pre-conditions** | User is on `/online/clients`. |
| **Steps** | 1. Click "Add Client" / "New Client".<br>2. Fill in name, phone, email, address, city.<br>3. Click "Save". |
| **Expected result** | Client is created and appears in the list. Success message is shown. |
| **Pass/Fail** | |

---

### TC-CLI-003 — Edit client

| Field | Value |
|---|---|
| **Pre-conditions** | At least one client exists. |
| **Steps** | 1. Click on a client row or edit button.<br>2. Update phone number or address.<br>3. Save changes. |
| **Expected result** | Changes are saved. Client details are updated. |
| **Pass/Fail** | |

---

### TC-CLI-004 — Delete client

| Field | Value |
|---|---|
| **Pre-conditions** | Client exists and deletion is allowed. |
| **Steps** | 1. Click delete on a client.<br>2. Confirm deletion. |
| **Expected result** | Client is removed from the list. |
| **Pass/Fail** | |

---

### TC-CLI-005 — View client detail / order history

| Field | Value |
|---|---|
| **Pre-conditions** | Client has at least one order. |
| **Steps** | 1. Click on a client row to open detail view. |
| **Expected result** | Client detail shows: contact info, all past orders (linked), total spend, average order value. |
| **Pass/Fail** | |

---

### TC-CLI-006 — Client segmentation

| Field | Value |
|---|---|
| **Pre-conditions** | Clients with varying order histories exist. Segmentation rules are configured. |
| **Steps** | 1. View client list.<br>2. Check the "Segment" column.<br>3. Filter by segment. |
| **Expected result** | Clients are correctly categorized (e.g., VIP, Regular, New). Segment assignment follows business rules. |
| **Pass/Fail** | |

---

### TC-CLI-007 — Client search

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple clients exist. |
| **Steps** | 1. Search by client name.<br>2. Search by phone number. |
| **Expected results** | Matching clients are shown. Partial matches work. |
| **Pass/Fail** | |

---

### TC-CLI-008 — Client list pagination

| Field | Value |
|---|---|
| **Pre-conditions** | More clients than page size exist. |
| **Steps** | 1. Navigate through pages. |
| **Expected result** | Pagination works correctly. |
| **Pass/Fail** | |

---

### TC-CLI-009 — Client export (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | Client list has data. |
| **Steps** | 1. Click "Export" button.<br>2. Select format (CSV/Excel). |
| **Expected result** | File is downloaded containing all client data. File opens correctly in a spreadsheet application. |
| **Pass/Fail** | |

---

## 6. CRM Analytics

### TC-CRM-001 — Analytics page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/crm`. |
| **Steps** | 1. Navigate to `/online/crm`.<br>2. Wait for page to load. |
| **Expected result** | Analytics dashboard renders with charts: client growth, revenue by segment, order frequency, top clients. |
| **Pass/Fail** | |

---

### TC-CRM-002 — Analytics date range filter

| Field | Value |
|---|---|
| **Pre-conditions** | Analytics page is loaded. |
| **Steps** | 1. Change the date range to "Last 30 days". |
| **Expected result** | All charts and KPIs update to reflect the selected period. |
| **Pass/Fail** | |

---

### TC-CRM-003 — Analytics chart interactivity

| Field | Value |
|---|---|
| **Pre-conditions** | Analytics page is loaded with data. |
| **Steps** | 1. Hover over chart data points.<br>2. Click on a chart segment (if drill-down is supported). |
| **Expected result** | Tooltips display exact values. Drill-down navigates to detailed view (if supported). |
| **Pass/Fail** | |

---

### TC-CRM-004 — Analytics empty state

| Field | Value |
|---|---|
| **Pre-conditions** | No client data exists for the selected period. |
| **Steps** | 1. Set date range to a period with no data. |
| **Expected result** | Charts show "No data available" message. No broken layouts. |
| **Pass/Fail** | |

---

## 7. Delivery (OzonExpress)

### TC-DEL-001 — Delivery page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/delivery`. OzonExpress integration is configured. |
| **Steps** | 1. Navigate to `/online/delivery`.<br>2. Wait for page to load. |
| **Expected result** | Delivery parcels list is displayed. Columns include order ID, tracking number, status, carrier, created date. |
| **Pass/Fail** | |

---

### TC-DEL-002 — Create delivery parcel

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists in "Confirmed" / "Ready to Ship" status. |
| **Steps** | 1. Select an order from the delivery queue.<br>2. Click "Create Parcel" / "Ship".<br>3. Fill in weight, dimensions if required.<br>4. Confirm. |
| **Expected result** | Parcel is created in OzonExpress. Tracking number is generated and displayed. Order status updates to "Shipped". |
| **Pass/Fail** | |

---

### TC-DEL-003 — Track parcel status

| Field | Value |
|---|---|
| **Pre-conditions** | A parcel with a tracking number exists. |
| **Steps** | 1. Click on a parcel row.<br>2. View tracking details. |
| **Expected result** | Tracking status is displayed (e.g., "In Transit", "Out for Delivery", "Delivered"). Status history with timestamps is shown. |
| **Pass/Fail** | |

---

### TC-DEL-004 — Refresh tracking status

| Field | Value |
|---|---|
| **Pre-conditions** | Parcel exists with a tracking number. |
| **Steps** | 1. Click "Refresh Status" / "Update Tracking". |
| **Expected result** | System fetches latest status from OzonExpress API. Status is updated if changed. |
| **Pass/Fail** | |

---

### TC-DEL-005 — Delivery page — filter by status

| Field | Value |
|---|---|
| **Pre-conditions** | Parcels with various statuses exist. |
| **Steps** | 1. Filter by "In Transit" status. |
| **Expected result** | Only parcels with "In Transit" status are shown. |
| **Pass/Fail** | |

---

### TC-DEL-006 — Delivery page — search by tracking number

| Field | Value |
|---|---|
| **Pre-conditions** | Known tracking numbers exist. |
| **Steps** | 1. Enter a tracking number in the search box. |
| **Expected result** | Matching parcel is shown. |
| **Pass/Fail** | |

---

### TC-DEL-007 — OzonExpress API error handling

| Field | Value |
|---|---|
| **Pre-conditions** | OzonExpress API is temporarily unavailable or credentials are invalid. |
| **Steps** | 1. Attempt to create a parcel or refresh tracking. |
| **Expected result** | User-friendly error message is shown (e.g., "Delivery service unavailable. Please try again later."). No data corruption. |
| **Pass/Fail** | |

---

### TC-DEL-008 — Delivery parcel pagination

| Field | Value |
|---|---|
| **Pre-conditions** | More parcels than page size exist. |
| **Steps** | 1. Navigate through pages. |
| **Expected result** | Pagination works correctly. |
| **Pass/Fail** | |

---

## 8. Finance (COD)

### TC-FIN-001 — Finance page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/finance`. |
| **Steps** | 1. Navigate to `/online/finance`.<br>2. Wait for page to load. |
| **Expected result** | Finance dashboard loads. Shows: total COD pending, total collected, total remitted, remittance history. |
| **Pass/Fail** | |

---

### TC-FIN-002 — Create remittance

| Field | Value |
|---|---|
| **Pre-conditions** | Orders marked as delivered and paid (COD) exist. No remittance has been created for them yet. |
| **Steps** | 1. Click "Create Remittance".<br>2. Select orders to include in the remittance.<br>3. Confirm the total amount.<br>4. Submit. |
| **Expected result** | Remittance record is created. Selected orders are marked as "Remitted". Remittance appears in the history. |
| **Pass/Fail** | |

---

### TC-FIN-003 — View remittance detail

| Field | Value |
|---|---|
| **Pre-conditions** | At least one remittance exists. |
| **Steps** | 1. Click on a remittance record. |
| **Expected result** | Remittance detail shows: date, total amount, list of included orders, status. |
| **Pass/Fail** | |

---

### TC-FIN-004 — Finance summary KPIs

| Field | Value |
|---|---|
| **Pre-conditions** | Finance page is loaded. |
| **Steps** | 1. Review KPI cards: total pending, collected, remitted.<br>2. Cross-reference with source data. |
| **Expected result** | KPI values are accurate and match order data. |
| **Pass/Fail** | |

---

### TC-FIN-005 — Finance date range filter

| Field | Value |
|---|---|
| **Pre-conditions** | Finance page is loaded. |
| **Steps** | 1. Select a date range.<br>2. Wait for data to update. |
| **Expected result** | All KPIs and the remittance list update to reflect the selected period. |
| **Pass/Fail** | |

---

### TC-FIN-006 — Finance — orders not yet remitted list

| Field | Value |
|---|---|
| **Pre-conditions** | Delivered + paid orders exist that haven't been remitted. |
| **Steps** | 1. View the "Pending Remittance" section or tab. |
| **Expected result** | List shows all eligible orders with correct amounts. |
| **Pass/Fail** | |

---

### TC-FIN-007 — Finance remittance export (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | Remittance records exist. |
| **Steps** | 1. Click "Export" on remittance history. |
| **Expected result** | File is downloaded with remittance data. |
| **Pass/Fail** | |

---

### TC-FIN-008 — Finance page pagination

| Field | Value |
|---|---|
| **Pre-conditions** | Many remittance records or pending orders exist. |
| **Steps** | 1. Navigate through pages of remittance history. |
| **Expected result** | Pagination works correctly. |
| **Pass/Fail** | |

---

## 9. Order Confirmation Queue

### TC-CONF-001 — Confirmation queue page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/confirmation`. |
| **Steps** | 1. Navigate to `/online/confirmation`.<br>2. Wait for page to load. |
| **Expected result** | Queue of orders awaiting confirmation is displayed. Each row shows: order ID, customer, phone, product(s), total, source, received date. |
| **Pass/Fail** | |

---

### TC-CONF-002 — Confirm an order

| Field | Value |
|---|---|
| **Pre-conditions** | At least one order is in the confirmation queue. |
| **Steps** | 1. Select an order from the queue.<br>2. Review order details (customer info, products, amount).<br>3. Click "Confirm" / "Approve". |
| **Expected result** | Order is removed from the queue. Order status advances (e.g., to "Confirmed" or "Processing"). Success notification is shown. |
| **Pass/Fail** | |

---

### TC-CONF-003 — Reject / cancel an order from the queue

| Field | Value |
|---|---|
| **Pre-conditions** | At least one order is in the confirmation queue. |
| **Steps** | 1. Select an order.<br>2. Click "Reject" / "Cancel".<br>3. Enter a reason (if required).<br>4. Confirm. |
| **Expected result** | Order is removed from the queue. Order status is set to "Cancelled" or "Rejected". Reason is logged. |
| **Pass/Fail** | |

---

### TC-CONF-004 — Bulk confirm orders

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple orders are in the confirmation queue. |
| **Steps** | 1. Select multiple orders using checkboxes.<br>2. Click "Confirm Selected" / "Bulk Confirm". |
| **Expected result** | All selected orders are confirmed in one action. Queue count decreases by the number confirmed. |
| **Pass/Fail** | |

---

### TC-CONF-005 — View order detail from queue

| Field | Value |
|---|---|
| **Pre-conditions** | Orders are in the queue. |
| **Steps** | 1. Click on an order row to expand or open detail view. |
| **Expected result** | Full order details are shown without leaving the queue page (inline expansion or modal). |
| **Pass/Fail** | |

---

### TC-CONF-006 — Confirmation queue search

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple orders in the queue. |
| **Steps** | 1. Search by customer name or phone. |
| **Expected result** | Matching orders are displayed. |
| **Pass/Fail** | |

---

### TC-CONF-007 — Confirmation queue pagination

| Field | Value |
|---|---|
| **Pre-conditions** | More orders than page size in the queue. |
| **Steps** | 1. Navigate through pages. |
| **Expected result** | Pagination works correctly. |
| **Pass/Fail** | |

---

### TC-CONF-008 — Confirmation queue — auto-refresh / real-time updates

| Field | Value |
|---|---|
| **Pre-conditions** | Queue page is open. |
| **Steps** | 1. Have a new order arrive (or simulate via API).<br>2. Observe the queue page. |
| **Expected result** | New order appears in the queue without manual refresh (if real-time is supported), or queue updates on next manual refresh. |
| **Pass/Fail** | |

---

## 10. Sync & Conflict Resolution

### TC-SYNC-001 — Sync page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/sync`. Shopify integration is configured. |
| **Steps** | 1. Navigate to `/online/sync`.<br>2. Wait for page to load. |
| **Expected result** | Sync dashboard loads. Shows: last sync time, sync status, stock conflicts list, pending sync items. |
| **Pass/Fail** | |

---

### TC-SYNC-002 — Trigger manual sync

| Field | Value |
|---|---|
| **Pre-conditions** | Sync page is loaded. |
| **Steps** | 1. Click "Sync Now" / "Trigger Sync". |
| **Expected result** | Sync process starts. Progress indicator is shown. Upon completion, results summary is displayed (X items synced, Y errors). |
| **Pass/Fail** | |

---

### TC-SYNC-003 — View stock conflicts

| Field | Value |
|---|---|
| **Pre-conditions** | Stock conflicts exist (local stock differs from Shopify stock). |
| **Steps** | 1. Navigate to the conflicts section on the sync page. |
| **Expected result** | List of conflicting products is shown. Each entry displays: product name, local stock, Shopify stock, last updated. |
| **Pass/Fail** | |

---

### TC-SYNC-004 — Resolve stock conflict — keep local

| Field | Value |
|---|---|
| **Pre-conditions** | A stock conflict exists. |
| **Steps** | 1. Select a conflict entry.<br>2. Click "Keep Local" / "Push to Shopify". |
| **Expected result** | Local stock value is pushed to Shopify. Conflict is marked as resolved. Shopify product stock updates. |
| **Pass/Fail** | |

---

### TC-SYNC-005 — Resolve stock conflict — keep Shopify

| Field | Value |
|---|---|
| **Pre-conditions** | A stock conflict exists. |
| **Steps** | 1. Select a conflict entry.<br>2. Click "Keep Shopify" / "Pull from Shopify". |
| **Expected result** | Shopify stock value is pulled to local system. Conflict is marked as resolved. Local product stock updates. |
| **Pass/Fail** | |

---

### TC-SYNC-006 — Bulk resolve conflicts

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple conflicts exist. |
| **Steps** | 1. Select multiple conflicts.<br>2. Choose "Keep Local" or "Keep Shopify" for all selected. |
| **Expected result** | All selected conflicts are resolved in bulk. Conflict count decreases. |
| **Pass/Fail** | |

---

### TC-SYNC-007 — Sync error handling

| Field | Value |
|---|---|
| **Pre-conditions** | Shopify API is down or credentials are invalid. |
| **Steps** | 1. Trigger a manual sync. |
| **Expected result** | Error message is displayed (e.g., "Sync failed: Shopify API unavailable"). No partial data corruption. Error is logged. |
| **Pass/Fail** | |

---

### TC-SYNC-008 — Sync history / log

| Field | Value |
|---|---|
| **Pre-conditions** | Previous sync operations have been performed. |
| **Steps** | 1. View the sync history/log section. |
| **Expected result** | Log shows: timestamp, action (push/pull), item count, status (success/error). Logs are chronologically ordered. |
| **Pass/Fail** | |

---

## 11. Variant Linking

### TC-LINK-001 — Variant linking page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/link`. |
| **Steps** | 1. Navigate to `/online/link`.<br>2. Wait for page to load. |
| **Expected result** | Variant linking interface loads. Shows: unmapped local products on one side, Shopify variants on the other. |
| **Pass/Fail** | |

---

### TC-LINK-002 — Link local product to Shopify variant

| Field | Value |
|---|---|
| **Pre-conditions** | Unlinked local product and corresponding Shopify variant exist. |
| **Steps** | 1. Select a local product.<br>2. Search for and select the matching Shopify variant.<br>3. Click "Link" / "Map". |
| **Expected result** | Link is created. Product-variant pair appears in the linked list. Status indicator shows "Linked". |
| **Pass/Fail** | |

---

### TC-LINK-003 — Unlink a variant

| Field | Value |
|---|---|
| **Pre-conditions** | A linked variant pair exists. |
| **Steps** | 1. Select the linked pair.<br>2. Click "Unlink".<br>3. Confirm. |
| **Expected result** | Link is removed. Product returns to the unmapped list. |
| **Pass/Fail** | |

---

### TC-LINK-004 — Search Shopify variants

| Field | Value |
|---|---|
| **Pre-conditions** | Shopify products/variants are available. |
| **Steps** | 1. Type a product name or SKU in the Shopify variant search. |
| **Expected result** | Matching Shopify variants are shown in the search results. |
| **Pass/Fail** | |

---

### TC-LINK-005 — Auto-suggest matching variants

| Field | Value |
|---|---|
| **Pre-conditions** | Local product has SKU or name that matches a Shopify variant. |
| **Steps** | 1. Select a local product to link.<br>2. Observe if suggestions appear automatically. |
| **Expected result** | System suggests potential matches based on SKU/name similarity. Suggestions are ranked by confidence. |
| **Pass/Fail** | |

---

### TC-LINK-006 — Prevent duplicate linking

| Field | Value |
|---|---|
| **Pre-conditions** | A Shopify variant is already linked to another local product. |
| **Steps** | 1. Attempt to link the same Shopify variant to a different local product. |
| **Expected result** | Error message is shown (e.g., "This Shopify variant is already linked to Product X"). Duplicate link is prevented. |
| **Pass/Fail** | |

---

## 12. Settings

### TC-SET-001 — Settings page loads

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. Navigates to `/online/settings`. |
| **Steps** | 1. Navigate to `/online/settings`.<br>2. Wait for page to load. |
| **Expected result** | Settings page loads with sections: Shopify config, OzonExpress config, WhatsApp config, General settings. |
| **Pass/Fail** | |

---

### TC-SET-002 — Save Shopify API credentials

| Field | Value |
|---|---|
| **Pre-conditions** | User is on Settings page, Shopify section. |
| **Steps** | 1. Enter Shopify Store URL.<br>2. Enter API Key.<br>3. Enter API Secret.<br>4. Click "Save". |
| **Expected result** | Settings are saved. Success message is shown. Connection test may be triggered. |
| **Pass/Fail** | |

---

### TC-SET-003 — Test Shopify connection

| Field | Value |
|---|---|
| **Pre-conditions** | Valid Shopify credentials are saved. |
| **Steps** | 1. Click "Test Connection" button. |
| **Expected result** | System verifies credentials with Shopify API. Success message is shown if valid. Error message if invalid. |
| **Pass/Fail** | |

---

### TC-SET-004 — Save OzonExpress credentials

| Field | Value |
|---|---|
| **Pre-conditions** | User is on Settings page, OzonExpress section. |
| **Steps** | 1. Enter OzonExpress API key and other required fields.<br>2. Click "Save". |
| **Expected result** | Settings are saved. Success message is shown. |
| **Pass/Fail** | |

---

### TC-SET-005 — Test OzonExpress connection

| Field | Value |
|---|---|
| **Pre-conditions** | Valid OzonExpress credentials are saved. |
| **Steps** | 1. Click "Test Connection". |
| **Expected result** | Connection is verified. Success or error message is shown. |
| **Pass/Fail** | |

---

### TC-SET-006 — Save WhatsApp integration config

| Field | Value |
|---|---|
| **Pre-conditions** | User is on Settings page, WhatsApp section. |
| **Steps** | 1. Enter WhatsApp API URL, token, phone number ID.<br>2. Click "Save". |
| **Expected result** | Settings are saved. Success message is shown. |
| **Pass/Fail** | |

---

### TC-SET-007 — Settings page — load existing values

| Field | Value |
|---|---|
| **Pre-conditions** | Settings have been previously saved. |
| **Steps** | 1. Navigate away from Settings page.<br>2. Navigate back to Settings page. |
| **Expected result** | All previously saved values are loaded and displayed in their respective fields. |
| **Pass/Fail** | |

---

### TC-SET-008 — Settings validation — required fields

| Field | Value |
|---|---|
| **Pre-conditions** | User is on Settings page. |
| **Steps** | 1. Clear a required field (e.g., Shopify API Key).<br>2. Click "Save". |
| **Expected result** | Validation error is shown for the required field. Settings are not saved. |
| **Pass/Fail** | |

---

### TC-SET-009 — Settings validation — invalid URL format

| Field | Value |
|---|---|
| **Pre-conditions** | User is on Settings page. |
| **Steps** | 1. Enter an invalid URL in the Shopify Store URL field (e.g., "not-a-url").<br>2. Click "Save". |
| **Expected result** | Validation error for invalid URL format. Settings are not saved. |
| **Pass/Fail** | |

---

### TC-SET-010 — Reset settings to defaults (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | Custom settings are saved. |
| **Steps** | 1. Click "Reset to Defaults".<br>2. Confirm. |
| **Expected result** | All settings revert to default values. Confirmation dialog is shown before reset. |
| **Pass/Fail** | |

---

## 13. WhatsApp Integration

### TC-WA-001 — Send order confirmation via WhatsApp

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists with a valid phone number. WhatsApp integration is configured. |
| **Steps** | 1. Open order detail.<br>2. Click "Send WhatsApp" / "Notify Customer". |
| **Expected result** | WhatsApp message is sent to the customer's phone number. Success message is shown. Message delivery status is logged. |
| **Pass/Fail** | |

---

### TC-WA-002 — Send delivery notification via WhatsApp

| Field | Value |
|---|---|
| **Pre-conditions** | Order has been shipped with tracking number. WhatsApp integration is configured. |
| **Steps** | 1. On the delivery page or order detail, click "Send Delivery Notification". |
| **Expected result** | Message with tracking information is sent via WhatsApp. |
| **Pass/Fail** | |

---

### TC-WA-003 — WhatsApp message template preview

| Field | Value |
|---|---|
| **Pre-conditions** | WhatsApp templates are configured in settings. |
| **Steps** | 1. Before sending a notification, preview the message content. |
| **Expected result** | Template renders correctly with order data (customer name, order ID, items, total). |
| **Pass/Fail** | |

---

### TC-WA-004 — WhatsApp send failure handling

| Field | Value |
|---|---|
| **Pre-conditions** | WhatsApp API is misconfigured or the phone number is invalid. |
| **Steps** | 1. Attempt to send a WhatsApp notification. |
| **Expected result** | Error message is shown. Order is not marked as notified. Error is logged. No retry loop. |
| **Pass/Fail** | |

---

### TC-WA-005 — WhatsApp bulk notification (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple orders are ready for notification. |
| **Steps** | 1. Select multiple orders.<br>2. Click "Send WhatsApp to All". |
| **Expected result** | Notifications are sent to all selected orders. Success/failure count is shown. |
| **Pass/Fail** | |

---

## 14. Printer / Packing Slip

### TC-PRN-001 — Generate packing slip for an order

| Field | Value |
|---|---|
| **Pre-conditions** | Order exists with confirmed status. |
| **Steps** | 1. Open order detail.<br>2. Click "Print Packing Slip" / "Generate Slip". |
| **Expected result** | Packing slip is generated as a printable document (PDF or print-ready HTML). Document includes: order ID, customer info, items, quantities, prices. |
| **Pass/Fail** | |

---

### TC-PRN-002 — Packing slip content accuracy

| Field | Value |
|---|---|
| **Pre-conditions** | Packing slip has been generated. |
| **Steps** | 1. Review the packing slip content against the order data. |
| **Expected result** | All data matches: customer name, address, products, quantities, prices, order date. No missing fields. |
| **Pass/Fail** | |

---

### TC-PRN-003 — Print packing slip via browser print dialog

| Field | Value |
|---|---|
| **Pre-conditions** | Packing slip is generated. |
| **Steps** | 1. Click "Print" on the packing slip preview.<br>2. Verify print dialog opens. |
| **Expected result** | Browser print dialog opens with the packing slip formatted for printing. Page layout is correct. |
| **Pass/Fail** | |

---

### TC-PRN-004 — Generate packing slip for bulk orders (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple orders are selected. |
| **Steps** | 1. Select multiple orders in the list.<br>2. Click "Print Packing Slips" (bulk action). |
| **Expected result** | Combined PDF or multiple slips are generated. Each slip corresponds to its order. |
| **Pass/Fail** | |

---

### TC-PRN-005 — Packing slip — handle orders with many items

| Field | Value |
|---|---|
| **Pre-conditions** | Order has 20+ line items. |
| **Steps** | 1. Generate packing slip for this order. |
| **Expected result** | Packing slip handles multiple pages correctly. All items are listed. Page breaks are properly placed. |
| **Pass/Fail** | |

---

## 15. Search, Filter & Pagination

### TC-SFP-001 — Global search (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | User is on any page. Global search bar is available. |
| **Steps** | 1. Type an order ID, product name, or client name in the global search.<br>2. Select a result. |
| **Expected result** | Search results appear. Clicking a result navigates to the correct page/entity. |
| **Pass/Fail** | |

---

### TC-SFP-002 — Search — no results

| Field | Value |
|---|---|
| **Pre-conditions** | User is on any list page. |
| **Steps** | 1. Search for a term that doesn't exist (e.g., "zzzznonexistent"). |
| **Expected result** | "No results found" message is displayed. No error. |
| **Pass/Fail** | |

---

### TC-SFP-003 — Search — special characters

| Field | Value |
|---|---|
| **Pre-conditions** | User is on any list page. |
| **Steps** | 1. Enter special characters in search (e.g., `<script>`, `' OR 1=1`, `%`, `*`). |
| **Expected result** | Search handles special characters gracefully. No XSS or SQL injection vulnerability. "No results" or empty list is shown. |
| **Pass/Fail** | |

---

### TC-SFP-004 — Filter — single filter applied

| Field | Value |
|---|---|
| **Pre-conditions** | List page has filter options. |
| **Steps** | 1. Apply one filter (e.g., status = "Pending"). |
| **Expected result** | List shows only matching items. Active filter is indicated visually (chip, badge). |
| **Pass/Fail** | |

---

### TC-SFP-005 — Filter — multiple filters combined

| Field | Value |
|---|---|
| **Pre-conditions** | List page supports multiple filters. |
| **Steps** | 1. Apply status filter = "Pending".<br>2. Apply date filter = "Last 7 days". |
| **Expected result** | List shows items matching ALL applied filters (AND logic). |
| **Pass/Fail** | |

---

### TC-SFP-006 — Clear all filters

| Field | Value |
|---|---|
| **Pre-conditions** | Multiple filters are active. |
| **Steps** | 1. Click "Clear Filters" / "Reset". |
| **Expected result** | All filters are removed. Full list is restored. |
| **Pass/Fail** | |

---

### TC-SFP-007 — Pagination — first/last page

| Field | Value |
|---|---|
| **Pre-conditions** | List has multiple pages. |
| **Steps** | 1. Click "First Page" button.<br>2. Click "Last Page" button. |
| **Expected result** | First page shows the first set of records. Last page shows the final set. |
| **Pass/Fail** | |

---

### TC-SFP-008 — Pagination — page size change (if supported)

| Field | Value |
|---|---|
| **Pre-conditions** | List page has a page size selector. |
| **Steps** | 1. Change page size from 20 to 50. |
| **Expected result** | List reloads with 50 items per page. Page count adjusts accordingly. |
| **Pass/Fail** | |

---

### TC-SFP-009 — Sort by column

| Field | Value |
|---|---|
| **Pre-conditions** | List table supports column sorting. |
| **Steps** | 1. Click a column header (e.g., "Date").<br>2. Click again to reverse sort. |
| **Expected result** | List sorts ascending on first click, descending on second. Sort indicator (arrow) is shown on the column. |
| **Pass/Fail** | |

---

### TC-SFP-010 — URL reflects filter/search state

| Field | Value |
|---|---|
| **Pre-conditions** | User is on a list page. |
| **Steps** | 1. Apply a filter and search.<br>2. Copy the URL.<br>3. Open the URL in a new tab. |
| **Expected result** | The new tab loads the same filtered/searched view. Filter state is preserved in URL params. |
| **Pass/Fail** | |

---

## 16. Error Handling & Edge Cases

### TC-ERR-001 — Network disconnection

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in and using the application. |
| **Steps** | 1. Disconnect from the network (disable Wi-Fi / unplug cable).<br>2. Attempt to navigate or perform an action. |
| **Expected result** | User-friendly message is shown (e.g., "No internet connection. Please check your network."). No data loss. App recovers when connection is restored. |
| **Pass/Fail** | |

---

### TC-ERR-002 — API server error (500)

| Field | Value |
|---|---|
| **Pre-conditions** | Backend returns a 500 error (simulate or wait for incident). |
| **Steps** | 1. Perform an action that triggers the failing API. |
| **Expected result** | Generic error message is shown (e.g., "Something went wrong. Please try again."). No sensitive error details are exposed to the user. |
| **Pass/Fail** | |

---

### TC-ERR-003 — API timeout

| Field | Value |
|---|---|
| **Pre-conditions** | API response is slow or times out. |
| **Steps** | 1. Trigger an API call that takes > 30 seconds. |
| **Expected result** | Timeout message is shown. User can retry. No duplicate submissions. |
| **Pass/Fail** | |

---

### TC-ERR-004 — Concurrent editing conflict

| Field | Value |
|---|---|
| **Pre-conditions** | Two users have the same order open for editing. |
| **Steps** | 1. User A saves a change.<br>2. User B saves a different change on the same field. |
| **Expected result** | User B receives a conflict notification (e.g., "This record was modified by another user. Please refresh."). Data is not silently overwritten. |
| **Pass/Fail** | |

---

### TC-ERR-005 — XSS prevention in input fields

| Field | Value |
|---|---|
| **Pre-conditions** | Any input field (order notes, client name, product name). |
| **Steps** | 1. Enter `<script>alert('XSS')</script>` in a text field.<br>2. Save.<br>3. View the saved value. |
| **Expected result** | Script is not executed. Input is sanitized/escaped. Plain text is displayed. |
| **Pass/Fail** | |

---

### TC-ERR-006 — SQL injection prevention

| Field | Value |
|---|---|
| **Pre-conditions** | Any search or input field. |
| **Steps** | 1. Enter `' OR '1'='1` in a search box.<br>2. Submit. |
| **Expected result** | No unexpected results are returned. Search treats the input as a literal string. |
| **Pass/Fail** | |

---

### TC-ERR-007 — Large file upload

| Field | Value |
|---|---|
| **Pre-conditions** | File upload is available (e.g., product image). |
| **Steps** | 1. Attempt to upload a file exceeding the maximum size (e.g., 50MB image). |
| **Expected result** | Error message is shown (e.g., "File too large. Maximum size is 5MB."). File is not uploaded. |
| **Pass/Fail** | |

---

### TC-ERR-008 — Browser back/forward navigation

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in and has navigated through multiple pages. |
| **Steps** | 1. Click the browser back button.<br>2. Click the browser forward button. |
| **Expected result** | Navigation works correctly. Previous page state is restored. No blank pages or errors. |
| **Pass/Fail** | |

---

### TC-ERR-009 — Session timeout during form editing

| Field | Value |
|---|---|
| **Pre-conditions** | User is editing a long form (e.g., new order). Session is about to expire. |
| **Steps** | 1. Start filling in a form.<br>2. Wait for session to expire.<br>3. Attempt to submit the form. |
| **Expected result** | User is prompted to log in again. Form data is either preserved (localStorage) or user is warned about unsaved changes. |
| **Pass/Fail** | |

---

### TC-ERR-010 — Double-click prevention on submit buttons

| Field | Value |
|---|---|
| **Pre-conditions** | Any form with a submit button. |
| **Steps** | 1. Quickly double-click the "Save" / "Submit" button. |
| **Expected result** | Only one request is sent. Button is disabled after first click or a loading spinner is shown. No duplicate records are created. |
| **Pass/Fail** | |

---

### TC-ERR-011 — Empty state — no data on list pages

| Field | Value |
|---|---|
| **Pre-conditions** | No records exist for a given entity (e.g., no orders, no clients). |
| **Steps** | 1. Navigate to the corresponding list page. |
| **Expected result** | Empty state message is shown (e.g., "No orders yet. Create your first order!"). Call-to-action button is available. No broken layout. |
| **Pass/Fail** | |

---

### TC-ERR-012 — Browser compatibility

| Field | Value |
|---|---|
| **Pre-conditions** | Application should work on supported browsers. |
| **Steps** | 1. Open the app in Chrome, Firefox, and Edge.<br>2. Perform basic navigation and actions on each. |
| **Expected result** | UI renders correctly on all browsers. No browser-specific layout breaks or JS errors. |
| **Pass/Fail** | |

---

### TC-ERR-013 — Deep-link to invalid route

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. |
| **Steps** | 1. Navigate to `/online/nonexistent-page`. |
| **Expected result** | 404 page is shown. User is not stuck. Navigation back to dashboard is available. |
| **Pass/Fail** | |

---

### TC-ERR-014 — Max input length validation

| Field | Value |
|---|---|
| **Pre-conditions** | Any text input field (e.g., notes, product description). |
| **Steps** | 1. Enter text exceeding the maximum allowed length.<br>2. Attempt to save. |
| **Expected result** | Validation error or truncation occurs per business rules. Data is not corrupted. |
| **Pass/Fail** | |

---

### TC-ERR-015 — Negative quantity / price edge case

| Field | Value |
|---|---|
| **Pre-conditions** | Order or product form is open. |
| **Steps** | 1. Enter a negative quantity (e.g., -5) or negative price. |
| **Expected result** | Validation error is shown (e.g., "Quantity must be positive."). Form is not submitted. |
| **Pass/Fail** | |

---

### TC-ERR-016 — Zero quantity edge case

| Field | Value |
|---|---|
| **Pre-conditions** | Order form is open. |
| **Steps** | 1. Enter quantity = 0 for a product. |
| **Expected result** | Validation error or the line item is removed. Order total is not affected by zero-quantity items. |
| **Pass/Fail** | |

---

### TC-ERR-017 — Extremely long input strings

| Field | Value |
|---|---|
| **Pre-conditions** | Any text input field. |
| **Steps** | 1. Paste a 10,000-character string into a name field. |
| **Expected result** | Input is truncated or rejected with a validation message. UI does not break. |
| **Pass/Fail** | |

---

### TC-ERR-018 — Currency / number formatting edge cases

| Field | Value |
|---|---|
| **Pre-conditions** | Finance or order pages with monetary values. |
| **Steps** | 1. Enter prices with many decimal places (e.g., 10.999).<br>2. Enter very large amounts (e.g., 999999999). |
| **Expected result** | Values are rounded/formatted correctly per business rules. No display overflow. |
| **Pass/Fail** | |

---

### TC-ERR-019 — Rapid page navigation

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in. |
| **Steps** | 1. Rapidly click between different navigation menu items (5+ clicks in 2 seconds). |
| **Expected result** | No race conditions. Final page loads correctly. Loading indicators don't stack. |
| **Pass/Fail** | |

---

### TC-ERR-020 — Local storage / cookie clearing mid-session

| Field | Value |
|---|---|
| **Pre-conditions** | User is logged in and active. |
| **Steps** | 1. Clear browser localStorage and cookies.<br>2. Attempt to navigate. |
| **Expected result** | User is redirected to login. No application crash. Graceful handling of missing auth state. |
| **Pass/Fail** | |

---

## Appendix A: Test Execution Summary

| Total Test Cases | Passed | Failed | Blocked | Not Executed |
|---|---|---|---|---|
| 118 | | | | |

## Appendix B: Defect Log Template

| Defect ID | Test Case ID | Description | Severity | Steps to Reproduce | Status | Assigned To |
|---|---|---|---|---|---|---|
| | | | | | | |

## Appendix C: Notes

- **Severity Levels:** Critical (system crash, data loss), Major (feature broken), Minor (UI issue), Trivial (cosmetic)
- **Test Data:** Ensure test data is reset between test cycles to avoid stale state
- **Environments:** Run all tests in staging before production deployment
- **Browser Testing:** Execute critical path tests on Chrome, Firefox, and Edge at minimum

---

*End of Manual Test Script — Online Store Module*
