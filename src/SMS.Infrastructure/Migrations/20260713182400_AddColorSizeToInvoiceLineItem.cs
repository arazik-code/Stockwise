using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddColorSizeToInvoiceLineItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ColorId",
                table: "InvoiceLineItems",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "SizeId",
                table: "InvoiceLineItems",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ColorId",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "SizeId",
                table: "InvoiceLineItems");
        }
    }
}
