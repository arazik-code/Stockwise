using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateRefundToSale : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RefundItems_InvoiceLineItems_InvoiceLineItemId",
                table: "RefundItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Refunds_Invoices_InvoiceId",
                table: "Refunds");

            migrationBuilder.RenameColumn(
                name: "InvoiceId",
                table: "Refunds",
                newName: "SaleId");

            migrationBuilder.RenameIndex(
                name: "IX_Refunds_InvoiceId",
                table: "Refunds",
                newName: "IX_Refunds_SaleId");

            migrationBuilder.RenameColumn(
                name: "InvoiceLineItemId",
                table: "RefundItems",
                newName: "SaleItemId");

            migrationBuilder.RenameIndex(
                name: "IX_RefundItems_InvoiceLineItemId",
                table: "RefundItems",
                newName: "IX_RefundItems_SaleItemId");

            migrationBuilder.AddColumn<int>(
                name: "ClientId",
                table: "Refunds",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Refunds_ClientId",
                table: "Refunds",
                column: "ClientId");

            migrationBuilder.AddForeignKey(
                name: "FK_RefundItems_SaleItems_SaleItemId",
                table: "RefundItems",
                column: "SaleItemId",
                principalTable: "SaleItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Refunds_Clients_ClientId",
                table: "Refunds",
                column: "ClientId",
                principalTable: "Clients",
                principalColumn: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_Refunds_Sales_SaleId",
                table: "Refunds",
                column: "SaleId",
                principalTable: "Sales",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_RefundItems_SaleItems_SaleItemId",
                table: "RefundItems");

            migrationBuilder.DropForeignKey(
                name: "FK_Refunds_Clients_ClientId",
                table: "Refunds");

            migrationBuilder.DropForeignKey(
                name: "FK_Refunds_Sales_SaleId",
                table: "Refunds");

            migrationBuilder.DropIndex(
                name: "IX_Refunds_ClientId",
                table: "Refunds");

            migrationBuilder.DropColumn(
                name: "ClientId",
                table: "Refunds");

            migrationBuilder.RenameColumn(
                name: "SaleId",
                table: "Refunds",
                newName: "InvoiceId");

            migrationBuilder.RenameIndex(
                name: "IX_Refunds_SaleId",
                table: "Refunds",
                newName: "IX_Refunds_InvoiceId");

            migrationBuilder.RenameColumn(
                name: "SaleItemId",
                table: "RefundItems",
                newName: "InvoiceLineItemId");

            migrationBuilder.RenameIndex(
                name: "IX_RefundItems_SaleItemId",
                table: "RefundItems",
                newName: "IX_RefundItems_InvoiceLineItemId");

            migrationBuilder.AddForeignKey(
                name: "FK_RefundItems_InvoiceLineItems_InvoiceLineItemId",
                table: "RefundItems",
                column: "InvoiceLineItemId",
                principalTable: "InvoiceLineItems",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Refunds_Invoices_InvoiceId",
                table: "Refunds",
                column: "InvoiceId",
                principalTable: "Invoices",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
