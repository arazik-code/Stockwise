using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddIsLiquidationToProductVariant : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceLineItems_Products_ProductId",
                table: "InvoiceLineItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_Products_ProductId",
                table: "SaleItems");

            migrationBuilder.DropForeignKey(
                name: "FK_StockItems_Products_ProductId",
                table: "StockItems");

            migrationBuilder.DropForeignKey(
                name: "FK_StockMovements_Products_ProductId",
                table: "StockMovements");

            migrationBuilder.DropIndex(
                name: "IX_StockMovements_CreatedAt",
                table: "StockMovements");

            migrationBuilder.DropIndex(
                name: "IX_Products_Barcode",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_ShopifyProductId",
                table: "Products");

            migrationBuilder.DropIndex(
                name: "IX_Products_Sku",
                table: "Products");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SizePresets",
                table: "SizePresets");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ColorPresets",
                table: "ColorPresets");

            migrationBuilder.DropColumn(
                name: "Barcode",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Color",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "CostPrice",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Price",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ShopifyProductId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Size",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "Sku",
                table: "Products");

            migrationBuilder.RenameTable(
                name: "SizePresets",
                newName: "SizePreset");

            migrationBuilder.RenameTable(
                name: "ColorPresets",
                newName: "ColorPreset");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                table: "StockMovements",
                newName: "ProductVariantId");

            migrationBuilder.RenameIndex(
                name: "IX_StockMovements_ProductId",
                table: "StockMovements",
                newName: "IX_StockMovements_ProductVariantId");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                table: "StockItems",
                newName: "ProductVariantId");

            migrationBuilder.RenameIndex(
                name: "IX_StockItems_ProductId",
                table: "StockItems",
                newName: "IX_StockItems_ProductVariantId");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                table: "SaleItems",
                newName: "ProductVariantId");

            migrationBuilder.RenameIndex(
                name: "IX_SaleItems_ProductId",
                table: "SaleItems",
                newName: "IX_SaleItems_ProductVariantId");

            migrationBuilder.RenameColumn(
                name: "ProductId",
                table: "InvoiceLineItems",
                newName: "ProductVariantId");

            migrationBuilder.RenameIndex(
                name: "IX_InvoiceLineItems_ProductId",
                table: "InvoiceLineItems",
                newName: "IX_InvoiceLineItems_ProductVariantId");

            migrationBuilder.AlterColumn<string>(
                name: "Reference",
                table: "StockMovements",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "StockMovements",
                type: "text",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "character varying(500)",
                oldMaxLength: 500,
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_SizePreset",
                table: "SizePreset",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ColorPreset",
                table: "ColorPreset",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "Colors",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    HexCode = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Colors", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Refunds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RefundNumber = table.Column<string>(type: "text", nullable: false),
                    InvoiceId = table.Column<int>(type: "integer", nullable: false),
                    Status = table.Column<string>(type: "text", nullable: false),
                    TotalRefundAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: false),
                    Notes = table.Column<string>(type: "text", nullable: true),
                    ProcessedByUserId = table.Column<int>(type: "integer", nullable: true),
                    RefundDate = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Refunds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Refunds_Invoices_InvoiceId",
                        column: x => x.InvoiceId,
                        principalTable: "Invoices",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Refunds_Users_ProcessedByUserId",
                        column: x => x.ProcessedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Sizes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Value = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Sizes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProductVariants",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    ColorId = table.Column<int>(type: "integer", nullable: false),
                    SizeId = table.Column<int>(type: "integer", nullable: false),
                    Sku = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Barcode = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    Price = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: false),
                    CostPrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    IsLiquidation = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductVariants", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ProductVariants_Colors_ColorId",
                        column: x => x.ColorId,
                        principalTable: "Colors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductVariants_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ProductVariants_Sizes_SizeId",
                        column: x => x.SizeId,
                        principalTable: "Sizes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "RefundItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RefundId = table.Column<int>(type: "integer", nullable: false),
                    InvoiceLineItemId = table.Column<int>(type: "integer", nullable: false),
                    ProductVariantId = table.Column<int>(type: "integer", nullable: false),
                    ProductName = table.Column<string>(type: "text", nullable: false),
                    Quantity = table.Column<int>(type: "integer", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "numeric", nullable: false),
                    RefundAmount = table.Column<decimal>(type: "numeric", nullable: false),
                    Reason = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RefundItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RefundItems_InvoiceLineItems_InvoiceLineItemId",
                        column: x => x.InvoiceLineItemId,
                        principalTable: "InvoiceLineItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RefundItems_ProductVariants_ProductVariantId",
                        column: x => x.ProductVariantId,
                        principalTable: "ProductVariants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_RefundItems_Refunds_RefundId",
                        column: x => x.RefundId,
                        principalTable: "Refunds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Colors_Name",
                table: "Colors",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_Barcode",
                table: "ProductVariants",
                column: "Barcode");

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ColorId",
                table: "ProductVariants",
                column: "ColorId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ProductId_ColorId_SizeId",
                table: "ProductVariants",
                columns: new[] { "ProductId", "ColorId", "SizeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_SizeId",
                table: "ProductVariants",
                column: "SizeId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_Sku",
                table: "ProductVariants",
                column: "Sku",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_RefundItems_InvoiceLineItemId",
                table: "RefundItems",
                column: "InvoiceLineItemId");

            migrationBuilder.CreateIndex(
                name: "IX_RefundItems_ProductVariantId",
                table: "RefundItems",
                column: "ProductVariantId");

            migrationBuilder.CreateIndex(
                name: "IX_RefundItems_RefundId",
                table: "RefundItems",
                column: "RefundId");

            migrationBuilder.CreateIndex(
                name: "IX_Refunds_InvoiceId",
                table: "Refunds",
                column: "InvoiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Refunds_ProcessedByUserId",
                table: "Refunds",
                column: "ProcessedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Sizes_Value",
                table: "Sizes",
                column: "Value",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceLineItems_ProductVariants_ProductVariantId",
                table: "InvoiceLineItems",
                column: "ProductVariantId",
                principalTable: "ProductVariants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_ProductVariants_ProductVariantId",
                table: "SaleItems",
                column: "ProductVariantId",
                principalTable: "ProductVariants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StockItems_ProductVariants_ProductVariantId",
                table: "StockItems",
                column: "ProductVariantId",
                principalTable: "ProductVariants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_StockMovements_ProductVariants_ProductVariantId",
                table: "StockMovements",
                column: "ProductVariantId",
                principalTable: "ProductVariants",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_InvoiceLineItems_ProductVariants_ProductVariantId",
                table: "InvoiceLineItems");

            migrationBuilder.DropForeignKey(
                name: "FK_SaleItems_ProductVariants_ProductVariantId",
                table: "SaleItems");

            migrationBuilder.DropForeignKey(
                name: "FK_StockItems_ProductVariants_ProductVariantId",
                table: "StockItems");

            migrationBuilder.DropForeignKey(
                name: "FK_StockMovements_ProductVariants_ProductVariantId",
                table: "StockMovements");

            migrationBuilder.DropTable(
                name: "RefundItems");

            migrationBuilder.DropTable(
                name: "ProductVariants");

            migrationBuilder.DropTable(
                name: "Refunds");

            migrationBuilder.DropTable(
                name: "Colors");

            migrationBuilder.DropTable(
                name: "Sizes");

            migrationBuilder.DropPrimaryKey(
                name: "PK_SizePreset",
                table: "SizePreset");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ColorPreset",
                table: "ColorPreset");

            migrationBuilder.RenameTable(
                name: "SizePreset",
                newName: "SizePresets");

            migrationBuilder.RenameTable(
                name: "ColorPreset",
                newName: "ColorPresets");

            migrationBuilder.RenameColumn(
                name: "ProductVariantId",
                table: "StockMovements",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_StockMovements_ProductVariantId",
                table: "StockMovements",
                newName: "IX_StockMovements_ProductId");

            migrationBuilder.RenameColumn(
                name: "ProductVariantId",
                table: "StockItems",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_StockItems_ProductVariantId",
                table: "StockItems",
                newName: "IX_StockItems_ProductId");

            migrationBuilder.RenameColumn(
                name: "ProductVariantId",
                table: "SaleItems",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_SaleItems_ProductVariantId",
                table: "SaleItems",
                newName: "IX_SaleItems_ProductId");

            migrationBuilder.RenameColumn(
                name: "ProductVariantId",
                table: "InvoiceLineItems",
                newName: "ProductId");

            migrationBuilder.RenameIndex(
                name: "IX_InvoiceLineItems_ProductVariantId",
                table: "InvoiceLineItems",
                newName: "IX_InvoiceLineItems_ProductId");

            migrationBuilder.AlterColumn<string>(
                name: "Reference",
                table: "StockMovements",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "Notes",
                table: "StockMovements",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                table: "Products",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Color",
                table: "Products",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "CostPrice",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "Price",
                table: "Products",
                type: "numeric(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<long>(
                name: "ShopifyProductId",
                table: "Products",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Size",
                table: "Products",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Sku",
                table: "Products",
                type: "character varying(50)",
                maxLength: 50,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddPrimaryKey(
                name: "PK_SizePresets",
                table: "SizePresets",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ColorPresets",
                table: "ColorPresets",
                column: "Id");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_CreatedAt",
                table: "StockMovements",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Barcode",
                table: "Products",
                column: "Barcode");

            migrationBuilder.CreateIndex(
                name: "IX_Products_ShopifyProductId",
                table: "Products",
                column: "ShopifyProductId");

            migrationBuilder.CreateIndex(
                name: "IX_Products_Sku",
                table: "Products",
                column: "Sku",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_InvoiceLineItems_Products_ProductId",
                table: "InvoiceLineItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_SaleItems_Products_ProductId",
                table: "SaleItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_StockItems_Products_ProductId",
                table: "StockItems",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_StockMovements_Products_ProductId",
                table: "StockMovements",
                column: "ProductId",
                principalTable: "Products",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
