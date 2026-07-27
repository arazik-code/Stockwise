using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SMS.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AlignProdSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // OnlineOrders and OnlineOrderItems were originally created by hand-written SQL
            // (not by EF), so their primary key constraints kept Postgres's default
            // "<table>_pkey" naming instead of EF's "PK_<Table>" convention. Harmless today,
            // but any future migration that needs to touch these PKs by name (e.g. an
            // AddPrimaryKey/DropPrimaryKey operation) would fail against the live database
            // if left unrenamed. Rename-only, no data movement, no downtime.
            migrationBuilder.Sql(
                "ALTER TABLE \"OnlineOrders\" RENAME CONSTRAINT \"OnlineOrders_pkey\" TO \"PK_OnlineOrders\";");
            migrationBuilder.Sql(
                "ALTER TABLE \"OnlineOrderItems\" RENAME CONSTRAINT \"OnlineOrderItems_pkey\" TO \"PK_OnlineOrderItems\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE \"OnlineOrders\" RENAME CONSTRAINT \"PK_OnlineOrders\" TO \"OnlineOrders_pkey\";");
            migrationBuilder.Sql(
                "ALTER TABLE \"OnlineOrderItems\" RENAME CONSTRAINT \"PK_OnlineOrderItems\" TO \"OnlineOrderItems_pkey\";");
        }
    }
}
