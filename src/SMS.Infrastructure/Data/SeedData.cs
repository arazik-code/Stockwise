using Microsoft.EntityFrameworkCore;
using SMS.Domain.Constants;
using SMS.Domain.Entities;
using SMS.Domain.Security;

namespace SMS.Infrastructure.Data;

public static class SeedData
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        await SeedRolesAsync(db);

        if (await db.Users.AnyAsync()) return;

        var adminRole = await db.Roles.SingleAsync(r => r.Name == "Admin");
        var cashierRole = await db.Roles.SingleAsync(r => r.Name == "Cashier");
        var stockManagerRole = await db.Roles.SingleAsync(r => r.Name == "StockManager");

        var admin = new User { Username = "admin", PasswordHash = PasswordHasher.Hash("admin123"), FullName = "Administrateur", RoleId = adminRole.Id, IsActive = true, MustChangePassword = true, CreatedAt = DateTime.UtcNow };
        var cashier = new User { Username = "cashier", PasswordHash = PasswordHasher.Hash("cashier123"), FullName = "Caissier", RoleId = cashierRole.Id, IsActive = true, MustChangePassword = true, CreatedAt = DateTime.UtcNow };
        var stockManager = new User { Username = "stock_manager", PasswordHash = PasswordHasher.Hash("stock123"), FullName = "Gestionnaire Stock", RoleId = stockManagerRole.Id, IsActive = true, MustChangePassword = true, CreatedAt = DateTime.UtcNow };

        db.Users.AddRange(admin, cashier, stockManager);
        await db.SaveChangesAsync();

        // Deliberately not printed to stdout - default credentials in a log file is exactly
        // the kind of thing that ends up committed or screen-shared. See deploy/SETUP.md.
        Console.WriteLine("[SeedData] Seeded 3 default accounts. See deploy/SETUP.md for initial credentials - change them on first login.");
    }

    // Public and called unconditionally from Program.cs, even in the Testing environment (unlike
    // the account seeding above, which the test host deliberately skips so each test controls its
    // own user data) - the 3 system Roles are structural reference data, not test-polluting
    // accounts, and AuthController.Register plus every new Admin* controller depend on them
    // existing. Idempotent: also picks up new Sections added to SystemRoleDefaults on redeploy.
    public static async Task SeedRolesAsync(AppDbContext db)
    {
        foreach (var (name, sections) in Sections.SystemRoleDefaults)
        {
            var role = await db.Roles.Include(r => r.Sections).FirstOrDefaultAsync(r => r.Name == name);
            if (role is null)
            {
                role = new Role { Name = name, IsSystem = true, CreatedAt = DateTime.UtcNow };
                db.Roles.Add(role);
                await db.SaveChangesAsync();
            }

            var existingKeys = role.Sections.Select(s => s.SectionKey).ToHashSet();
            foreach (var key in sections.Where(key => !existingKeys.Contains(key)))
                db.Set<RoleSection>().Add(new RoleSection { RoleId = role.Id, SectionKey = key });
        }
        await db.SaveChangesAsync();
    }
}
