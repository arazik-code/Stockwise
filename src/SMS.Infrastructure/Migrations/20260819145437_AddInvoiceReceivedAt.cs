using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddInvoiceReceivedAt : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ReceivedAt",
                table: "Invoices",
                type: "timestamp with time zone",
                nullable: true);

            // Backfill for existing data: a "Received" invoice was obviously received. A
            // PartiallyPaid/Paid invoice was only received if it actually has a matching Purchase
            // stock movement (Type = 5) - the receive flow writes one per invoice via
            // Reference = InvoiceNumber - since paying could historically happen without ever
            // receiving first (Fournisseurs Factures tab's Pay button never checked status).
            migrationBuilder.Sql(@"
                UPDATE ""Invoices""
                SET ""ReceivedAt"" = COALESCE(""UpdatedAt"", ""InvoiceDate"")
                WHERE ""Status"" = 'Received';

                UPDATE ""Invoices"" i
                SET ""ReceivedAt"" = sub.""FirstReceivedAt""
                FROM (
                    SELECT sm.""Reference"" AS ""InvoiceNumber"", MIN(sm.""CreatedAt"") AS ""FirstReceivedAt""
                    FROM ""StockMovements"" sm
                    WHERE sm.""Type"" = 5
                    GROUP BY sm.""Reference""
                ) sub
                WHERE i.""InvoiceNumber"" = sub.""InvoiceNumber""
                  AND i.""Status"" IN ('PartiallyPaid', 'Paid')
                  AND i.""ReceivedAt"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReceivedAt",
                table: "Invoices");
        }
    }
}
