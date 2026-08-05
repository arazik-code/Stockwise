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
            // "<table>_pkey" naming instead of EF's "PK_<Table>" convention on that one already-
            // existing database. Harmless today, but any future migration that needs to touch
            // these PKs by name (e.g. an AddPrimaryKey/DropPrimaryKey operation) would fail
            // against that live database if left unrenamed. Rename-only, no data movement, no
            // downtime.
            //
            // Guarded with an existence check (unlike a bare RENAME CONSTRAINT, Postgres has no
            // IF EXISTS form for that specific clause) because a genuinely fresh database - e.g.
            // a brand-new EF-created install, first proven when this replayed against an empty
            // Postgres on initial VPS deployment - already creates these tables with the
            // "PK_<Table>" name from InitialBaseline onward, so there is no "<table>_pkey" to
            // rename and the bare version threw 42704 (constraint does not exist).
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnlineOrders_pkey') THEN
                        ALTER TABLE ""OnlineOrders"" RENAME CONSTRAINT ""OnlineOrders_pkey"" TO ""PK_OnlineOrders"";
                    END IF;
                END $$;");
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnlineOrderItems_pkey') THEN
                        ALTER TABLE ""OnlineOrderItems"" RENAME CONSTRAINT ""OnlineOrderItems_pkey"" TO ""PK_OnlineOrderItems"";
                    END IF;
                END $$;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_OnlineOrders') THEN
                        ALTER TABLE ""OnlineOrders"" RENAME CONSTRAINT ""PK_OnlineOrders"" TO ""OnlineOrders_pkey"";
                    END IF;
                END $$;");
            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PK_OnlineOrderItems') THEN
                        ALTER TABLE ""OnlineOrderItems"" RENAME CONSTRAINT ""PK_OnlineOrderItems"" TO ""OnlineOrderItems_pkey"";
                    END IF;
                END $$;");
        }
    }
}
