using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _configuration;

    public AuthController(AppDbContext db, IConfiguration configuration)
    {
        _db = db;
        _configuration = configuration;
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive, ct);
        if (user is null)
            return Unauthorized(new { message = "Invalid credentials" });

        if (!VerifyPassword(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid credentials" });

        var token = GenerateJwtToken(user);

        return Ok(new
        {
            token,
            user = new
            {
                user.Id,
                user.Username,
                user.FullName,
                Role = user.Role.ToString(),
                user.MustChangePassword
            }
        });
    }

    // Creating accounts is an admin action, not a public signup form - this used to be
    // AllowAnonymous and accepted a Role straight from the request body, so anyone who
    // could reach the API could mint themselves an Admin account.
    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username, ct);
        if (existing is not null)
            return Conflict(new { message = "Username already exists" });

        var user = new SMS.Domain.Entities.User
        {
            Username = request.Username,
            PasswordHash = HashPassword(request.Password),
            FullName = request.FullName,
            Role = request.Role ?? SMS.Domain.Enums.UserRole.Cashier,
            IsActive = true,
            MustChangePassword = true,
            CreatedAt = DateTime.UtcNow
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(null, new
        {
            user = new
            {
                user.Id,
                user.Username,
                user.FullName,
                Role = user.Role.ToString()
            }
        });
    }

    [HttpGet("me")]
    public IActionResult Me()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var username = User.FindFirstValue(ClaimTypes.Name) ?? string.Empty;
        var fullName = User.FindFirstValue("FullName") ?? string.Empty;
        var role = User.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        return Ok(new { userId, username, fullName, role });
    }

    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request, CancellationToken ct)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId, ct);
        if (user is null) return NotFound();

        if (!VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Mot de passe actuel incorrect" });

        if (request.NewPassword.Length < 8)
            return BadRequest(new { message = "Le nouveau mot de passe doit contenir au moins 8 caracteres" });

        user.PasswordHash = HashPassword(request.NewPassword);
        user.MustChangePassword = false;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Mot de passe change avec succes" });
    }

    private string GenerateJwtToken(SMS.Domain.Entities.User user)
    {
        var secretKey = _configuration["Jwt:SecretKey"] ?? throw new InvalidOperationException("Jwt:SecretKey not configured");
        var issuer = _configuration["Jwt:Issuer"] ?? "StockManagementSystem";
        var audience = _configuration["Jwt:Audience"] ?? "StockManagementSystem";
        var expirationMinutes = int.TryParse(_configuration["Jwt:ExpirationMinutes"], out var exp) ? exp : 480;

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim("FullName", user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(expirationMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    private static string HashPassword(string password)
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(16);
        var hash = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
            password, salt, 100000, System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
        var combined = new byte[49];
        Buffer.BlockCopy(salt, 0, combined, 1, 16);
        Buffer.BlockCopy(hash, 0, combined, 17, 32);
        return Convert.ToBase64String(combined);
    }

    private static bool VerifyPassword(string password, string storedHash)
    {
        var combined = Convert.FromBase64String(storedHash);
        var salt = new byte[16];
        Buffer.BlockCopy(combined, 1, salt, 0, 16);
        var hash = new byte[32];
        Buffer.BlockCopy(combined, 17, hash, 0, 32);
        var computed = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(
            password, salt, 100000, System.Security.Cryptography.HashAlgorithmName.SHA256, 32);
        return hash.AsSpan().SequenceEqual(computed);
    }
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string FullName, SMS.Domain.Enums.UserRole? Role);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
