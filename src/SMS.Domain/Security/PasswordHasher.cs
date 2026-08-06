using System.Security.Cryptography;

namespace SMS.Domain.Security;

// PBKDF2-SHA256, 100k iterations, 16-byte salt. Single source of truth - previously duplicated
// across AuthController and SeedData.
public static class PasswordHasher
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        var combined = new byte[1 + SaltSize + HashSize];
        Buffer.BlockCopy(salt, 0, combined, 1, SaltSize);
        Buffer.BlockCopy(hash, 0, combined, 1 + SaltSize, HashSize);
        return Convert.ToBase64String(combined);
    }

    public static bool Verify(string password, string storedHash)
    {
        var combined = Convert.FromBase64String(storedHash);
        var salt = new byte[SaltSize];
        Buffer.BlockCopy(combined, 1, salt, 0, SaltSize);
        var hash = new byte[HashSize];
        Buffer.BlockCopy(combined, 1 + SaltSize, hash, 0, HashSize);
        var computed = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, HashSize);
        return hash.AsSpan().SequenceEqual(computed);
    }

    public static string GenerateTempPassword()
    {
        // Admin-set temp passwords always force MustChangePassword=true, so this only needs to
        // satisfy the strength policy (upper+lower+digit+special) for one login, not be memorable.
        // One char from each required category is placed deterministically, then the rest is
        // random and the whole thing is shuffled - a purely random draw could statistically miss
        // a category and fail the very policy it's supposed to satisfy.
        const string upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const string lower = "abcdefghijkmnopqrstuvwxyz";
        const string digits = "23456789";
        const string special = "!@#$%";
        const string all = upper + lower + digits + special;

        var result = new List<char>
        {
            upper[RandomNumberGenerator.GetInt32(upper.Length)],
            lower[RandomNumberGenerator.GetInt32(lower.Length)],
            digits[RandomNumberGenerator.GetInt32(digits.Length)],
            special[RandomNumberGenerator.GetInt32(special.Length)]
        };
        for (var i = 0; i < 10; i++)
            result.Add(all[RandomNumberGenerator.GetInt32(all.Length)]);

        for (var i = result.Count - 1; i > 0; i--)
        {
            var j = RandomNumberGenerator.GetInt32(i + 1);
            (result[i], result[j]) = (result[j], result[i]);
        }
        return new string(result.ToArray());
    }
}
