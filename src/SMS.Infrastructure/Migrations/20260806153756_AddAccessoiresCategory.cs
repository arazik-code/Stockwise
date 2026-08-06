using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddAccessoiresCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data-only: seeds the "Accessoires" category the POS default view now filters to
            // (see PosPage.tsx). Idempotent - safe if it already exists (e.g. re-run/rollback+reapply).
            migrationBuilder.Sql(@"
                INSERT INTO ""Categories"" (""Name"", ""Description"", ""CreatedAt"", ""UpdatedAt"")
                SELECT 'Accessoires', 'Ceintures, montres, vestes en cuir et autres accessoires', NOW(), NOW()
                WHERE NOT EXISTS (SELECT 1 FROM ""Categories"" WHERE ""Name"" = 'Accessoires');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Only removed if empty - never silently delete a category an admin has since put
            // real products in.
            migrationBuilder.Sql(@"
                DELETE FROM ""Categories""
                WHERE ""Name"" = 'Accessoires'
                  AND NOT EXISTS (SELECT 1 FROM ""Products"" WHERE ""CategoryId"" = ""Categories"".""Id"");");
        }
    }
}
