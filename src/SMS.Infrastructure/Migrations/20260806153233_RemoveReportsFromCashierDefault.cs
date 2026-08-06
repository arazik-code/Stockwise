using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class RemoveReportsFromCashierDefault : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Data-only correction: SeedRolesAsync is additive-only (it never revokes a section a
            // role already has, so an admin's own edits via the Roles UI survive every restart) -
            // that means updating Sections.SystemRoleDefaults in code alone can't retract the
            // Reports grant the Cashier system role was originally seeded with. This is the one-time
            // removal for databases that already ran the original seed.
            migrationBuilder.Sql(@"
                DELETE FROM ""RoleSections""
                WHERE ""SectionKey"" = 'Reports'
                  AND ""RoleId"" = (SELECT ""Id"" FROM ""Roles"" WHERE ""Name"" = 'Cashier' AND ""IsSystem"" = true);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO ""RoleSections"" (""RoleId"", ""SectionKey"")
                SELECT r.""Id"", 'Reports'
                FROM ""Roles"" r
                WHERE r.""Name"" = 'Cashier' AND r.""IsSystem"" = true
                  AND NOT EXISTS (
                    SELECT 1 FROM ""RoleSections"" rs WHERE rs.""RoleId"" = r.""Id"" AND rs.""SectionKey"" = 'Reports'
                  );");
        }
    }
}
