using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddColorNameSizeValueToInvoiceLineItem : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ColorName",
                table: "InvoiceLineItems",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SizeValue",
                table: "InvoiceLineItems",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ColorName",
                table: "InvoiceLineItems");

            migrationBuilder.DropColumn(
                name: "SizeValue",
                table: "InvoiceLineItems");
        }
    }
}
