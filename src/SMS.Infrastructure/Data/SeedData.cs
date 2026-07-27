using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Infrastructure.Data;

public static class SeedData
{
    public static async Task InitializeAsync(AppDbContext db)
    {
        if (await db.Users.AnyAsync()) return;

        var adminHash = HashPassword("admin123");
        var cashierHash = HashPassword("cashier123");
        var stockManagerHash = HashPassword("stock123");

        var admin = new User { Username = "admin", PasswordHash = adminHash, FullName = "Administrateur", Role = UserRole.Admin, IsActive = true, CreatedAt = DateTime.UtcNow };
        var cashier = new User { Username = "cashier", PasswordHash = cashierHash, FullName = "Caissier", Role = UserRole.Cashier, IsActive = true, CreatedAt = DateTime.UtcNow };
        var stockManager = new User { Username = "stock_manager", PasswordHash = stockManagerHash, FullName = "Gestionnaire Stock", Role = UserRole.StockManager, IsActive = true, CreatedAt = DateTime.UtcNow };

        db.Users.AddRange(admin, cashier, stockManager);
        await db.SaveChangesAsync();

        Console.WriteLine($"[SeedData] Seeded 3 users: admin/admin123, cashier/cashier123, stock_manager/stock123");
    }

    private static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, HashAlgorithmName.SHA256, 32);
        var combined = new byte[49];
        Buffer.BlockCopy(salt, 0, combined, 1, 16);
        Buffer.BlockCopy(hash, 0, combined, 17, 32);
        return Convert.ToBase64String(combined);
    }
}
