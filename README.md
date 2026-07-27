# Stock Management System

A unified stock management system for a shoes store that sells locally (POS) and on Shopify. Both channels share the same inventory — a sale on either channel instantly updates the other.

## Architecture

- **Backend**: ASP.NET Core 8 + EF Core + PostgreSQL
- **Frontend**: React 19 + TypeScript + Tailwind CSS + Vite
- **Real-time**: SignalR for instant POS inventory updates
- **Shopify**: Webhook-based sync with polling fallback

## Quick Start

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download)
- [Node.js 18+](https://nodejs.org/)
- [PostgreSQL 16+](https://www.postgresql.org/)

### 1. Start PostgreSQL
```bash
docker-compose up postgres -d
```

### 2. Setup Backend
```bash
cd src/SMS.API
dotnet restore
dotnet run
```
The API will be available at `https://localhost:7001` with Swagger at `/swagger`.

### 3. Setup Frontend
```bash
cd src/SMS.React
npm install
npm run dev
```
The React app will be available at `http://localhost:5173`.

## Project Structure

```
StockManagementSystem/
├── src/
│   ├── SMS.Domain/           # Entities, enums, interfaces
│   ├── SMS.Application/      # Services, DTOs, validators
│   ├── SMS.Infrastructure/   # EF Core, Shopify, SignalR
│   ├── SMS.API/              # Controllers + webhooks
│   └── SMS.React/            # React SPA
├── tests/                    # Unit + integration tests
├── docker-compose.yml        # PostgreSQL + API
└── StockManagementSystem.sln
```

## Key Features

### Stock Management
- Products with SKU, barcode, size, color, brand
- Categories (hierarchical) and producers/suppliers
- Stock levels with reorder alerts
- Stock adjustment with audit trail

### Sales (POS)
- Product grid with search and barcode scanning
- Cart with quantity management
- Checkout with cash/card payment
- Receipt generation

### Shopify Integration
- Real-time webhook sync for orders
- Inventory level synchronization
- Polling fallback for missed webhooks
- Conflict resolution for last-item races

### Real-time Updates
- SignalR pushes stock changes to POS
- Low stock alerts
- New Shopify order notifications

## API Endpoints

| Controller | Endpoints |
|---|---|
| Products | CRUD, search, barcode lookup |
| Categories | CRUD (tree structure) |
| Producers | CRUD |
| Stock | Levels, adjust, movements |
| Sales | Create, list, reports |
| Shopify | Orders, sync trigger, status |
| Reports | Dashboard, inventory, sales |

## Configuration

Edit `src/SMS.API/appsettings.json`:

```json
{
  "ConnectionStrings": {
    "Default": "Host=localhost;Database=StockManagement;Username=postgres;Password=postgres"
  },
  "Shopify": {
    "ShopDomain": "your-store.myshopify.com",
    "AccessToken": "your-access-token",
    "WebhookSecret": "your-webhook-secret"
  }
}
```
