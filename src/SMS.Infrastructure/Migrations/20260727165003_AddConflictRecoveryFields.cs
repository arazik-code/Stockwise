using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddConflictRecoveryFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "ProductVariantId",
                table: "OnlineOrderItems",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<long>(
                name: "ShopifyProductId",
                table: "OnlineOrderItems",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ShopifySku",
                table: "OnlineOrderItems",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "ShopifyVariantId",
                table: "OnlineOrderItems",
                type: "bigint",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnlineOrderItems_ShopifyVariantId",
                table: "OnlineOrderItems",
                column: "ShopifyVariantId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OnlineOrderItems_ShopifyVariantId",
                table: "OnlineOrderItems");

            migrationBuilder.DropColumn(
                name: "ShopifyProductId",
                table: "OnlineOrderItems");

            migrationBuilder.DropColumn(
                name: "ShopifySku",
                table: "OnlineOrderItems");

            migrationBuilder.DropColumn(
                name: "ShopifyVariantId",
                table: "OnlineOrderItems");

            migrationBuilder.AlterColumn<int>(
                name: "ProductVariantId",
                table: "OnlineOrderItems",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);
        }
    }
}
