using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClientLoyaltyCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CategoryUpdatedAt",
                table: "Clients",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ComputedCategory",
                table: "Clients",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "EffectiveCategory",
                table: "Clients",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ManualCategory",
                table: "Clients",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Clients_EffectiveCategory",
                table: "Clients",
                column: "EffectiveCategory");

            // Backfill: tier every existing client from their real purchase history the moment this
            // migration runs, rather than leaving everyone at the "Nouveau" default until the app-level
            // recalculate action is clicked. Mirrors ClientCategoryAppService.ClientCategoryEngine's
            // thresholds (Premium >= 4000 DH or 6+ orders, Bon >= 1200 DH or 3+ orders) and the same
            // itemized-then-Shopify-fallback rule used everywhere else in this codebase. Sales has no
            // status exclusion (matches the existing CRM aggregate); OnlineOrders excludes Cancelled(4)
            // and InventoryConflict(6). Rates use the LoyaltySettings defaults (5/8/12) - LoyaltyRate is
            // only ever a denormalized display cache (see ILoyaltyRateResolver), self-healing on the
            // next sale/recalculate if the store has customized those rates.
            migrationBuilder.Sql(@"
                WITH sales_agg AS (
                    SELECT ""ClientId"" AS client_id, SUM(""TotalAmount"") AS spent, COUNT(*) AS orders
                    FROM ""Sales""
                    WHERE ""ClientId"" IS NOT NULL
                    GROUP BY ""ClientId""
                ),
                online_agg AS (
                    SELECT ""ClientId"" AS client_id, SUM(""TotalAmount"") AS spent, COUNT(*) AS orders
                    FROM ""OnlineOrders""
                    WHERE ""ClientId"" IS NOT NULL AND ""Status"" NOT IN (4, 6)
                    GROUP BY ""ClientId""
                ),
                effective AS (
                    SELECT
                        c.""Id"" AS client_id,
                        CASE WHEN COALESCE(sa.orders, 0) + COALESCE(oa.orders, 0) > 0
                            THEN COALESCE(sa.spent, 0) + COALESCE(oa.spent, 0)
                            ELSE COALESCE(c.""ShopifyTotalSpent"", 0)
                        END AS eff_spent,
                        CASE WHEN COALESCE(sa.orders, 0) + COALESCE(oa.orders, 0) > 0
                            THEN COALESCE(sa.orders, 0) + COALESCE(oa.orders, 0)
                            ELSE COALESCE(c.""ShopifyOrdersCount"", 0)
                        END AS eff_orders
                    FROM ""Clients"" c
                    LEFT JOIN sales_agg sa ON sa.client_id = c.""Id""
                    LEFT JOIN online_agg oa ON oa.client_id = c.""Id""
                )
                UPDATE ""Clients"" c
                SET
                    ""ComputedCategory"" = CASE
                        WHEN e.eff_spent >= 4000 OR e.eff_orders >= 6 THEN 2
                        WHEN e.eff_spent >= 1200 OR e.eff_orders >= 3 THEN 1
                        ELSE 0
                    END,
                    ""EffectiveCategory"" = CASE
                        WHEN e.eff_spent >= 4000 OR e.eff_orders >= 6 THEN 2
                        WHEN e.eff_spent >= 1200 OR e.eff_orders >= 3 THEN 1
                        ELSE 0
                    END,
                    ""LoyaltyRate"" = CASE
                        WHEN e.eff_spent >= 4000 OR e.eff_orders >= 6 THEN 12
                        WHEN e.eff_spent >= 1200 OR e.eff_orders >= 3 THEN 8
                        ELSE 5
                    END,
                    ""CategoryUpdatedAt"" = NOW()
                FROM effective e
                WHERE c.""Id"" = e.client_id;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Clients_EffectiveCategory",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "CategoryUpdatedAt",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ComputedCategory",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "EffectiveCategory",
                table: "Clients");

            migrationBuilder.DropColumn(
                name: "ManualCategory",
                table: "Clients");
        }
    }
}
