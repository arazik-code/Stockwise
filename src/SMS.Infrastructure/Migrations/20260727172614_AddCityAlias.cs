using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddCityAlias : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "CityCanonical",
                table: "OnlineOrders",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "OzonCityId",
                table: "OnlineOrders",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "CityAliases",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RawKey = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    OzonCityId = table.Column<int>(type: "integer", nullable: false),
                    CanonicalName = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    Confidence = table.Column<int>(type: "integer", nullable: false),
                    Source = table.Column<int>(type: "integer", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CityAliases", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CityAliases_OzonCities_OzonCityId",
                        column: x => x.OzonCityId,
                        principalTable: "OzonCities",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_OnlineOrders_OzonCityId",
                table: "OnlineOrders",
                column: "OzonCityId");

            migrationBuilder.CreateIndex(
                name: "IX_CityAliases_OzonCityId",
                table: "CityAliases",
                column: "OzonCityId");

            migrationBuilder.CreateIndex(
                name: "IX_CityAliases_RawKey",
                table: "CityAliases",
                column: "RawKey",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "CityAliases");

            migrationBuilder.DropIndex(
                name: "IX_OnlineOrders_OzonCityId",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "CityCanonical",
                table: "OnlineOrders");

            migrationBuilder.DropColumn(
                name: "OzonCityId",
                table: "OnlineOrders");
        }
    }
}
