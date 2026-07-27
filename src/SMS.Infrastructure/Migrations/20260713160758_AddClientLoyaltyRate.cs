using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddClientLoyaltyRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "LoyaltyRate",
                table: "Clients",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.Sql("UPDATE \"Clients\" SET \"LoyaltyRate\" = 8 WHERE \"LoyaltyRate\" = 5");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LoyaltyRate",
                table: "Clients");
        }
    }
}
