using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddUserMustChangePassword : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "MustChangePassword",
                table: "Users",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            // The three seeded default accounts (admin/admin123, cashier/cashier123,
            // stock_manager/stock123) are still on their original passwords in production -
            // confirmed live during this security audit. Force a change on next login.
            migrationBuilder.Sql(
                "UPDATE \"Users\" SET \"MustChangePassword\" = true WHERE \"Username\" IN ('admin', 'cashier', 'stock_manager');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MustChangePassword",
                table: "Users");
        }
    }
}
