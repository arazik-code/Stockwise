using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SMS.Domain.Security;
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
        var user = await _db.Users.Include(u => u.Role).ThenInclude(r => r.Sections)
            .FirstOrDefaultAsync(u => u.Username == request.Username && u.IsActive, ct);
        if (user is null)
            return Unauthorized(new { message = "Invalid credentials" });

        if (!PasswordHasher.Verify(request.Password, user.PasswordHash))
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
                Role = user.Role.Name,
                user.MustChangePassword
            }
        });
    }

    // Kept for backwards compatibility - always creates a Cashier account. Admins who want to
    // choose a role (built-in or custom) should use POST /api/admin/users instead.
    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest request, CancellationToken ct)
    {
        var existing = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username, ct);
        if (existing is not null)
            return Conflict(new { message = "Username already exists" });

        var passwordError = PasswordPolicy.Validate(request.Password);
        if (passwordError is not null)
            return BadRequest(new { message = passwordError });

        var cashierRole = await _db.Roles.FirstOrDefaultAsync(r => r.Name == "Cashier", ct);
        if (cashierRole is null)
            return StatusCode(500, new { message = "Default Cashier role is not seeded" });

        var user = new SMS.Domain.Entities.User
        {
            Username = request.Username,
            PasswordHash = PasswordHasher.Hash(request.Password),
            FullName = request.FullName,
            RoleId = cashierRole.Id,
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
                Role = cashierRole.Name
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

        if (!PasswordHasher.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Mot de passe actuel incorrect" });

        var passwordError = PasswordPolicy.Validate(request.NewPassword);
        if (passwordError is not null)
            return BadRequest(new { message = passwordError });

        user.PasswordHash = PasswordHasher.Hash(request.NewPassword);
        user.MustChangePassword = false;
        await _db.SaveChangesAsync(ct);

        return Ok(new { message = "Mot de passe change avec succes" });
    }

    private string GenerateJwtToken(SMS.Domain.Entities.User user)
    {
        var secretKey = _configuration["Jwt:SecretKey"]
            ?? Environment.GetEnvironmentVariable("JWT_SECRET_KEY")
            ?? throw new InvalidOperationException("Jwt:SecretKey not configured");
        var issuer = _configuration["Jwt:Issuer"] ?? "StockManagementSystem";
        var audience = _configuration["Jwt:Audience"] ?? "StockManagementSystem";
        var expirationMinutes = int.TryParse(_configuration["Jwt:ExpirationMinutes"], out var exp) ? exp : 480;

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new("FullName", user.FullName),
            new(ClaimTypes.Role, user.Role.Name),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        // Additive alongside the Role claim above - see SMS.API.Authorization.RequireSectionAttribute.
        // Admin doesn't need these baked in (it bypasses every section check), but including them
        // anyway keeps the token self-describing for the frontend's own nav-hiding logic.
        claims.AddRange(user.Role.Sections.Select(s => new Claim("section", s.SectionKey)));

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
}

public record LoginRequest(string Username, string Password);
public record RegisterRequest(string Username, string Password, string FullName);
public record ChangePasswordRequest(string CurrentPassword, string NewPassword);
