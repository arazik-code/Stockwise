using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCodLedger : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "SettlementStatus",
                table: "OnlineOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.CreateTable(
                name: "CourierRemittances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Carrier = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    PeriodStart = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    PeriodEnd = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DeclaredAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    MatchedAmount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    ReceivedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    BankRef = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    CreatedByUserId = table.Column<int>(type: "integer", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CourierRemittances", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "CodLedgerEntries",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OnlineOrderId = table.Column<int>(type: "integer", nullable: false),
                    OzonParcelId = table.Column<int>(type: "integer", nullable: true),
                    Type = table.Column<int>(type: "integer", nullable: false),
                    Amount = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CourierRemittanceId = table.Column<int>(type: "integer", nullable: true),
                    Source = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OccurredAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CodLedgerEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CodLedgerEntries_CourierRemittances_CourierRemittanceId",
                        column: x => x.CourierRemittanceId,
                        principalTable: "CourierRemittances",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CodLedgerEntries_OnlineOrders_OnlineOrderId",
                        column: x => x.OnlineOrderId,
                        principalTable: "OnlineOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_CodLedgerEntries_OzonParcels_OzonParcelId",
                        column: x => x.OzonParcelId,
                        principalTable: "OzonParcels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnlineOrders_SettlementStatus",
                table: "OnlineOrders",
                column: "SettlementStatus");

            migrationBuilder.CreateIndex(
                name: "IX_CodLedgerEntries_CourierRemittanceId",
                table: "CodLedgerEntries",
                column: "CourierRemittanceId");

            migrationBuilder.CreateIndex(
                name: "IX_CodLedgerEntries_OnlineOrderId",
                table: "CodLedgerEntries",
                column: "OnlineOrderId");

            migrationBuilder.CreateIndex(
                name: "IX_CodLedgerEntries_OzonParcelId",
                table: "CodLedgerEntries",
                column: "OzonParcelId");

            migrationBuilder.CreateIndex(
                name: "IX_CodLedgerEntries_Type",
                table: "CodLedgerEntries",
                column: "Type");

            migrationBuilder.CreateIndex(
                name: "IX_CourierRemittances_Status",
                table: "CourierRemittances",
                column: "Status");

            // Historical backfill: 1654 delivered orders were sitting marked Unpaid with no
            // reconciliation of any kind, because the COD ledger didn't exist and courier tracking
            // never wrote back to the order at all (fixed separately - see AddOrderStatusHistory).
            // These predate any OzonParcel record, so there is nothing left to reconstruct - mark
            // them Paid/Remitted with an explicit audit note rather than pretending to recover
            // remittance history that was never captured. The ledger starts tracking for real from
            // here forward.
            migrationBuilder.Sql(@"
                INSERT INTO ""CodLedgerEntries"" (""OnlineOrderId"", ""Type"", ""Amount"", ""Source"", ""Note"", ""OccurredAt"", ""CreatedAt"")
                SELECT ""Id"", 6, ""TotalAmount"", 'System',
                       'Backfill historique : commande livree avant la mise en place du grand livre COD - montant marque paye/solde sans reconstitution du remis reel.',
                       COALESCE(""DeliveredAt"", ""UpdatedAt""), now()
                FROM ""OnlineOrders""
                WHERE ""Status"" = 3 AND ""PaymentStatus"" = 0;

                UPDATE ""OnlineOrders""
                SET ""PaymentStatus"" = 1,
                    ""AmountPaid"" = ""TotalAmount"",
                    ""SettlementStatus"" = 2
                WHERE ""Status"" = 3 AND ""PaymentStatus"" = 0;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CodLedgerEntries");

            migrationBuilder.DropTable(
                name: "CourierRemittances");

            migrationBuilder.DropIndex(
                name: "IX_OnlineOrders_SettlementStatus",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "SettlementStatus",
                table: "OnlineOrders");
        }
    }
}
