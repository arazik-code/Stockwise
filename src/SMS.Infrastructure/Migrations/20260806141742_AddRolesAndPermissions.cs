using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddRolesAndPermissions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AuditLogs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ActorUserId = table.Column<int>(type: "integer", nullable: true),
                    ActorUsername = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    TargetType = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    TargetId = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    Details = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLogs", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Roles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Description = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    IsSystem = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Roles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "RoleSections",
                columns: table => new
                {
                    RoleId = table.Column<int>(type: "integer", nullable: false),
                    SectionKey = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RoleSections", x => new { x.RoleId, x.SectionKey });
                    table.ForeignKey(
                        name: "FK_RoleSections_Roles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "Roles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            // Seed the 3 system roles here (not via SeedData.cs, which only ever runs against an
            // empty Users table) - needed as FK targets for the Users.RoleId backfill below, on
            // whichever database already has real user rows (the VPS). Hardcoded names, not a
            // reference to Sections.SystemRoleDefaults - migrations must stay self-contained and
            // not depend on mutable app code that could change in a later release.
            migrationBuilder.Sql(@"
                INSERT INTO ""Roles"" (""Name"", ""IsSystem"", ""CreatedAt"")
                SELECT v.name, true, NOW()
                FROM (VALUES ('Admin'), ('Cashier'), ('StockManager')) AS v(name)
                WHERE NOT EXISTS (SELECT 1 FROM ""Roles"" r WHERE r.""Name"" = v.name);");

            // The old "Role" column held the UserRole enum's int value (Admin=0, Manager=1,
            // Cashier=2, StockManager=3). Renaming alone would leave those raw ints sitting in
            // RoleId, which almost never match the new Roles.Id identity values by coincidence -
            // remap explicitly before the FK constraint below is added, or it fails immediately
            // against any database that already has real user rows (this is a genuinely new
            // migration path - unlike AlignProdSchema, there's no fresh-vs-existing split here
            // since a fresh DB simply has zero Users rows at this point and the UPDATE is a no-op).
            migrationBuilder.RenameColumn(
                name: "Role",
                table: "Users",
                newName: "RoleId");

            migrationBuilder.Sql(@"
                UPDATE ""Users"" u SET ""RoleId"" = r.""Id""
                FROM ""Roles"" r
                WHERE r.""Name"" = CASE u.""RoleId""
                    WHEN 0 THEN 'Admin'
                    WHEN 1 THEN 'Cashier'  -- old Manager value, never actually seeded/used
                    WHEN 2 THEN 'Cashier'
                    WHEN 3 THEN 'StockManager'
                    ELSE 'Cashier'         -- unknown/corrupt value: fail safe to least privilege
                END;");

            migrationBuilder.CreateIndex(
                name: "IX_Users_RoleId",
                table: "Users",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "IX_AuditLogs_CreatedAt",
                table: "AuditLogs",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_Roles_Name",
                table: "Roles",
                column: "Name",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_Roles_RoleId",
                table: "Users",
                column: "RoleId",
                principalTable: "Roles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                UPDATE ""Users"" u SET ""RoleId"" = CASE r.""Name""
                    WHEN 'Admin' THEN 0
                    WHEN 'Cashier' THEN 2
                    WHEN 'StockManager' THEN 3
                    ELSE 2
                END
                FROM ""Roles"" r
                WHERE r.""Id"" = u.""RoleId"";");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_Roles_RoleId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "AuditLogs");

            migrationBuilder.DropTable(
                name: "RoleSections");

            migrationBuilder.DropTable(
                name: "Roles");

            migrationBuilder.DropIndex(
                name: "IX_Users_RoleId",
                table: "Users");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "Users",
                newName: "Role");
        }
    }
}
