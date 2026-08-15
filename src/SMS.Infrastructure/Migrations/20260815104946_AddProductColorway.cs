using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <summary>
    /// Introduces the colourway tier: the (Product x Color) row that sits between Product and
    /// ProductVariant and owns the Shopify link.
    ///
    /// The order of operations below is load-bearing and deliberately not the order EF scaffolded.
    /// The table has to exist and be filled before ProductVariants.ColorwayId can be made NOT NULL,
    /// and Products.ShopifyProductId has to survive until its values have been copied down onto the
    /// colourways. Written as explicit SQL rather than a data-seeding pass in C# so the whole
    /// backfill runs inside the migration's own transaction on the live database.
    /// </summary>
    public partial class AddProductColorway : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // ── 1. The table itself ───────────────────────────────────────────────────────────
            migrationBuilder.CreateTable(
                name: "ProductColorways",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ProductId = table.Column<int>(type: "integer", nullable: false),
                    ColorId = table.Column<int>(type: "integer", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    OnlinePrice = table.Column<decimal>(type: "numeric(18,2)", precision: 18, scale: 2, nullable: true),
                    ShopifyProductId = table.Column<long>(type: "bigint", nullable: true),
                    ShopifyTitle = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    SortOrder = table.Column<int>(type: "integer", nullable: false),
                    IsActive = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProductColorways", x => x.Id);
                    table.UniqueConstraint("AK_ProductColorways_Id_ProductId_ColorId", x => new { x.Id, x.ProductId, x.ColorId });
                    table.ForeignKey(
                        name: "FK_ProductColorways_Colors_ColorId",
                        column: x => x.ColorId,
                        principalTable: "Colors",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ProductColorways_Products_ProductId",
                        column: x => x.ProductId,
                        principalTable: "Products",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // ── 2. One colourway per distinct (product, colour) already in use ────────────────
            // SortOrder follows the colour's own SortOrder so the POS colour strip comes out in the
            // same order the colour master defines, rather than by insertion accident.
            migrationBuilder.Sql("""
                INSERT INTO "ProductColorways"
                    ("ProductId", "ColorId", "ImageUrl", "OnlinePrice", "SortOrder", "IsActive", "CreatedAt", "UpdatedAt")
                SELECT
                    v."ProductId",
                    v."ColorId",
                    p."ImageUrl",
                    p."OnlinePrice",
                    ROW_NUMBER() OVER (PARTITION BY v."ProductId" ORDER BY c."SortOrder", c."Id") - 1,
                    p."IsActive",
                    NOW() AT TIME ZONE 'UTC',
                    NOW() AT TIME ZONE 'UTC'
                FROM (SELECT DISTINCT "ProductId", "ColorId" FROM "ProductVariants") v
                JOIN "Products" p ON p."Id" = v."ProductId"
                JOIN "Colors"   c ON c."Id" = v."ColorId";
                """);

            // ── 3. Move each product's Shopify link down onto ONE of its colourways ───────────
            // A Shopify product is a single colourway, so only one can carry the link. Where a
            // local product has several colourways the choice is genuinely ambiguous - take the
            // lowest colour sort order deterministically and leave the rest NULL, so the regrouping
            // and manual-link screens have something unambiguous to correct.
            migrationBuilder.Sql("""
                UPDATE "ProductColorways" cw
                SET "ShopifyProductId" = p."ShopifyProductId"
                FROM "Products" p
                WHERE p."Id" = cw."ProductId"
                  AND p."ShopifyProductId" IS NOT NULL
                  AND cw."Id" = (
                      SELECT c2."Id" FROM "ProductColorways" c2
                      WHERE c2."ProductId" = cw."ProductId"
                      ORDER BY c2."SortOrder", c2."Id"
                      LIMIT 1
                  );
                """);

            // Two products sharing one Shopify id would break the partial unique index below. It
            // should not happen (the importer keys on it), but a duplicate must not take the whole
            // migration down - keep the lowest colourway and unlink the rest for manual review.
            migrationBuilder.Sql("""
                UPDATE "ProductColorways" cw
                SET "ShopifyProductId" = NULL
                WHERE cw."ShopifyProductId" IS NOT NULL
                  AND cw."Id" <> (
                      SELECT MIN(c2."Id") FROM "ProductColorways" c2
                      WHERE c2."ShopifyProductId" = cw."ShopifyProductId"
                  );
                """);

            // ── 4. Point every existing variant at its colourway ─────────────────────────────
            migrationBuilder.AddColumn<int>(
                name: "ColorwayId",
                table: "ProductVariants",
                type: "integer",
                nullable: true);

            migrationBuilder.Sql("""
                UPDATE "ProductVariants" v
                SET "ColorwayId" = cw."Id"
                FROM "ProductColorways" cw
                WHERE cw."ProductId" = v."ProductId"
                  AND cw."ColorId"   = v."ColorId";
                """);

            // Step 2 derived the colourways from these very rows, so a NULL here means the data
            // changed underneath us. Fail loudly rather than write a broken NOT NULL default.
            migrationBuilder.Sql("""
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM "ProductVariants" WHERE "ColorwayId" IS NULL) THEN
                        RAISE EXCEPTION 'Colourway backfill incomplete: % variant(s) unmatched',
                            (SELECT COUNT(*) FROM "ProductVariants" WHERE "ColorwayId" IS NULL);
                    END IF;
                END $$;
                """);

            migrationBuilder.AlterColumn<int>(
                name: "ColorwayId",
                table: "ProductVariants",
                type: "integer",
                nullable: false);

            // ── 5. Constraints, now that the data satisfies them ─────────────────────────────
            migrationBuilder.CreateIndex(
                name: "IX_ProductColorways_ColorId",
                table: "ProductColorways",
                column: "ColorId");

            migrationBuilder.CreateIndex(
                name: "IX_ProductColorways_ProductId_ColorId",
                table: "ProductColorways",
                columns: new[] { "ProductId", "ColorId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProductColorways_ShopifyProductId",
                table: "ProductColorways",
                column: "ShopifyProductId",
                unique: true,
                filter: "\"ShopifyProductId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ColorwayId_ProductId_ColorId",
                table: "ProductVariants",
                columns: new[] { "ColorwayId", "ProductId", "ColorId" });

            migrationBuilder.CreateIndex(
                name: "IX_ProductVariants_ColorwayId_SizeId",
                table: "ProductVariants",
                columns: new[] { "ColorwayId", "SizeId" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ProductVariants_ProductColorways_ColorwayId_ProductId_Color~",
                table: "ProductVariants",
                columns: new[] { "ColorwayId", "ProductId", "ColorId" },
                principalTable: "ProductColorways",
                principalColumns: new[] { "Id", "ProductId", "ColorId" },
                onDelete: ReferentialAction.Restrict);

            // ── 6. Finally retire the scalar the colourways replaced ─────────────────────────
            migrationBuilder.DropIndex(
                name: "IX_Products_ShopifyProductId",
                table: "Products");

            migrationBuilder.DropColumn(
                name: "ShopifyProductId",
                table: "Products");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "ShopifyProductId",
                table: "Products",
                type: "bigint",
                nullable: true);

            // Restore the scalar from whichever colourway ended up holding the link.
            migrationBuilder.Sql("""
                UPDATE "Products" p
                SET "ShopifyProductId" = cw."ShopifyProductId"
                FROM "ProductColorways" cw
                WHERE cw."ProductId" = p."Id"
                  AND cw."ShopifyProductId" IS NOT NULL
                  AND cw."Id" = (
                      SELECT MIN(c2."Id") FROM "ProductColorways" c2
                      WHERE c2."ProductId" = p."Id" AND c2."ShopifyProductId" IS NOT NULL
                  );
                """);

            migrationBuilder.CreateIndex(
                name: "IX_Products_ShopifyProductId",
                table: "Products",
                column: "ShopifyProductId");

            migrationBuilder.DropForeignKey(
                name: "FK_ProductVariants_ProductColorways_ColorwayId_ProductId_Color~",
                table: "ProductVariants");

            migrationBuilder.DropIndex(
                name: "IX_ProductVariants_ColorwayId_ProductId_ColorId",
                table: "ProductVariants");

            migrationBuilder.DropIndex(
                name: "IX_ProductVariants_ColorwayId_SizeId",
                table: "ProductVariants");

            migrationBuilder.DropColumn(
                name: "ColorwayId",
                table: "ProductVariants");

            migrationBuilder.DropTable(
                name: "ProductColorways");
        }
    }
}
