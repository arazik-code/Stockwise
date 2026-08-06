namespace SMS.Domain.Constants;

// Fixed taxonomy of app areas a Role can be granted access to. The list itself is code-defined
// (not admin-editable) - what's dynamic is which Sections a given Role grants, via RoleSection.
// Keep this in sync by hand with src/SMS.React/src/constants/sections.ts (small, stable list).
public static class Sections
{
    public const string Dashboard = "Dashboard";
    public const string Pos = "POS";
    public const string Products = "Products";
    public const string Stock = "Stock";
    public const string Catalog = "Catalog";
    public const string Fournisseurs = "Fournisseurs";
    public const string Clients = "Clients";
    public const string Refunds = "Refunds";
    public const string Invoices = "Invoices";
    public const string CashDrawer = "CashDrawer";
    public const string Reports = "Reports";
    public const string Settings = "Settings";
    public const string WhatsApp = "WhatsApp";
    public const string Shopify = "Shopify";
    public const string OnlineOrders = "OnlineOrders";
    // Split from OnlineOrders: OnlineOrdersController (Admin+StockManager) and
    // OrderConfirmationController (Admin+StockManager+Cashier) have different access today -
    // merging them into one section would silently broaden either Cashier or StockManager access.
    public const string OrderConfirmation = "OrderConfirmation";
    public const string OzonExpress = "OzonExpress";
    public const string CodFinance = "CodFinance";
    public const string AdminUsers = "AdminUsers";
    public const string AdminRoles = "AdminRoles";
    public const string AdminHealth = "AdminHealth";

    public static readonly IReadOnlyList<string> All = new[]
    {
        Dashboard, Pos, Products, Stock, Catalog, Fournisseurs, Clients, Refunds, Invoices,
        CashDrawer, Reports, Settings, WhatsApp, Shopify, OnlineOrders, OrderConfirmation,
        OzonExpress, CodFinance, AdminUsers, AdminRoles, AdminHealth
    };

    // Reproduces today's real [Authorize(Roles=...)] matrix across all controllers, so seeding
    // the 3 system roles from this is a zero-behavior-change migration.
    public static readonly IReadOnlyDictionary<string, string[]> SystemRoleDefaults = new Dictionary<string, string[]>
    {
        ["Admin"] = All.ToArray(),
        // Cashier keeps Pos (checkout, exchanges, refunds all read/write through it) but not
        // Reports - that also removes the "Ventes" analytics view (SalesController's
        // daily-report/report/sales-report actions are gated on Reports too, see SalesController)
        // and the whole ReportsController/Reports page.
        ["Cashier"] = new[] { Dashboard, Pos, Clients, Refunds, WhatsApp, OrderConfirmation },
        ["StockManager"] = new[]
        {
            Dashboard, Products, Stock, Catalog, Fournisseurs, Invoices, Reports, WhatsApp,
            Shopify, OnlineOrders, OrderConfirmation, OzonExpress, CodFinance
        }
    };
}
