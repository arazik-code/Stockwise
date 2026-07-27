using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderConfirmationQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AssignedAgentUserId",
                table: "OnlineOrders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AttemptCount",
                table: "OnlineOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "ConfirmationStatus",
                table: "OnlineOrders",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastAttemptAt",
                table: "OnlineOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "NextCallbackAt",
                table: "OnlineOrders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "OrderConfirmationAttempts",
                columns: table => new
                {
                    Id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    OnlineOrderId = table.Column<int>(type: "integer", nullable: false),
                    AttemptNumber = table.Column<int>(type: "integer", nullable: false),
                    Channel = table.Column<int>(type: "integer", nullable: false),
                    Outcome = table.Column<int>(type: "integer", nullable: false),
                    AgentUserId = table.Column<int>(type: "integer", nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    NextCallbackAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OrderConfirmationAttempts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_OrderConfirmationAttempts_OnlineOrders_OnlineOrderId",
                        column: x => x.OnlineOrderId,
                        principalTable: "OnlineOrders",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnlineOrders_ConfirmationStatus_NextCallbackAt",
                table: "OnlineOrders",
                columns: new[] { "ConfirmationStatus", "NextCallbackAt" });

            migrationBuilder.CreateIndex(
                name: "IX_OrderConfirmationAttempts_OnlineOrderId_CreatedAt",
                table: "OrderConfirmationAttempts",
                columns: new[] { "OnlineOrderId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "OrderConfirmationAttempts");

            migrationBuilder.DropIndex(
                name: "IX_OnlineOrders_ConfirmationStatus_NextCallbackAt",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "AssignedAgentUserId",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "AttemptCount",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "ConfirmationStatus",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "LastAttemptAt",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "NextCallbackAt",
                table: "OnlineOrders");
        }
    }
}
