using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using SMS.API.Authorization;
using SMS.Application.DTOs;
using SMS.Application.DTOs.Clients;
using SMS.Application.DTOs.Sales;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Clients)]
public class ClientsController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly LoyaltySettings _loyaltySettings;
    private readonly IClientCrmService _crmService;
    private readonly IClientLoyaltyCategoryService _categoryService;

    public ClientsController(
        AppDbContext db,
        IOptions<LoyaltySettings> loyaltySettings,
        IClientCrmService crmService,
        IClientLoyaltyCategoryService categoryService)
    {
        _db = db;
        _loyaltySettings = loyaltySettings.Value;
        _crmService = crmService;
        _categoryService = categoryService;
    }

    [HttpGet("crm-summary")]
    public async Task<IActionResult> GetCrmSummary(CancellationToken ct)
    {
        return Ok(await _crmService.GetDashboardAsync(ct));
    }

    [HttpGet("crm-analytics")]
    public async Task<IActionResult> GetCrmAnalytics(CancellationToken ct)
    {
        return Ok(await _crmService.GetCrmAnalyticsAsync(ct));
    }

    [HttpGet("{id:int}/analytics")]
    public async Task<IActionResult> GetAnalytics(int id, CancellationToken ct)
    {
        var analytics = await _crmService.GetClientAnalyticsAsync(id, ct);
        if (analytics is null) return NotFound();
        return Ok(analytics);
    }

    [HttpPost("import-shopify")]
    public async Task<IActionResult> ImportShopifyClients(CancellationToken ct)
    {
        var result = await _crmService.ImportClientsFromShopifyAsync(ct);
        return Ok(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] ClientCategory? category, CancellationToken ct)
    {
        var query = _db.Clients.AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var q = search.ToLower();
            query = query.Where(c => c.Name.ToLower().Contains(q) || c.Phone.ToLower().Contains(q));
        }

        if (category.HasValue)
            query = query.Where(c => c.EffectiveCategory == category.Value);

        var clients = await query
            .OrderByDescending(c => c.LastVisitAt)
            .Select(c => new ClientDto
            {
                Id = c.Id,
                Name = c.Name,
                Phone = c.Phone,
                QrCode = c.QrCode,
                TotalPoints = c.TotalPoints,
                LifetimePoints = c.LifetimePoints,
                TotalSpent = c.TotalSpent,
                VisitCount = c.Sales.Count,
                LoyaltyRate = c.LoyaltyRate,
                CreatedAt = c.CreatedAt,
                LastVisitAt = c.LastVisitAt,
                EffectiveCategory = c.EffectiveCategory,
                ManualCategory = c.ManualCategory,
                ComputedCategory = c.ComputedCategory,
                CategoryUpdatedAt = c.CategoryUpdatedAt
            })
            .ToListAsync(ct);
        return Ok(clients);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var client = await _db.Clients
            .Include(c => c.LoyaltyTransactions.OrderByDescending(t => t.CreatedAt).Take(20))
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (client is null) return NotFound();

        return Ok(MapToDto(client));
    }

    [HttpGet("{id:int}/sales")]
    public async Task<IActionResult> GetSales(int id, CancellationToken ct)
    {
        var exists = await _db.Clients.AnyAsync(c => c.Id == id, ct);
        if (!exists) return NotFound();

        var sales = await _db.Sales
            .Include(s => s.Items)
                .ThenInclude(i => i.ProductVariant)
                    .ThenInclude(pv => pv.Product)
            .Include(s => s.Items)
                .ThenInclude(i => i.ProductVariant)
                    .ThenInclude(pv => pv.Color)
            .Include(s => s.Items)
                .ThenInclude(i => i.ProductVariant)
                    .ThenInclude(pv => pv.Size)
            .Include(s => s.User)
            .Include(s => s.Client)
            .Where(s => s.ClientId == id)
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SaleDto
            {
                Id = s.Id,
                SaleNumber = s.SaleNumber,
                Channel = s.Channel,
                Category = s.Category,
                PaymentMethod = s.PaymentMethod,
                SubTotal = s.SubTotal,
                TaxAmount = s.TaxAmount,
                DiscountAmount = s.DiscountAmount,
                TotalAmount = s.TotalAmount,
                AmountPaid = s.AmountPaid,
                ChangeGiven = s.ChangeGiven,
                Status = s.Status,
                UserName = s.User != null ? s.User.FullName : null,
                ClientId = s.ClientId,
                ClientName = s.Client != null ? s.Client.Name : null,
                LoyaltyPointsEarned = s.LoyaltyPointsEarned,
                LoyaltyPointsRedeemed = s.LoyaltyPointsRedeemed,
                LoyaltyDiscountAmount = s.LoyaltyDiscountAmount,
                Items = s.Items.Select(i => new SaleItemDto
                {
                    Id = i.Id,
                    SaleId = i.SaleId,
                    ProductVariantId = i.ProductVariantId,
                    ProductName = i.ProductVariant != null && i.ProductVariant.Product != null ? i.ProductVariant.Product.Name : string.Empty,
                    VariantSku = i.ProductVariant != null ? i.ProductVariant.Sku : string.Empty,
                    VariantBarcode = i.ProductVariant != null ? i.ProductVariant.Barcode : null,
                    ColorName = i.ProductVariant != null && i.ProductVariant.Color != null ? i.ProductVariant.Color.Name : string.Empty,
                    SizeValue = i.ProductVariant != null && i.ProductVariant.Size != null ? i.ProductVariant.Size.Value : string.Empty,
                    Quantity = i.Quantity,
                    UnitPrice = i.UnitPrice,
                    CostPrice = i.ProductVariant != null && i.ProductVariant.Product != null ? (i.ProductVariant.Product.CostPrice ?? 0) : 0,
                    DiscountAmount = i.DiscountAmount,
                    LineTotal = i.LineTotal
                }).ToList(),
                CreatedAt = s.CreatedAt
            })
            .ToListAsync(ct);
        return Ok(sales);
    }

    [HttpGet("qr/{qrCode}")]
    public async Task<IActionResult> GetByQrCode(string qrCode, CancellationToken ct)
    {
        var client = await _db.Clients
            .Include(c => c.LoyaltyTransactions.OrderByDescending(t => t.CreatedAt).Take(10))
            .FirstOrDefaultAsync(c => c.QrCode == qrCode, ct);
        if (client is null) return NotFound();

        return Ok(MapToDto(client));
    }

    [HttpGet("phone/{phone}")]
    public async Task<IActionResult> GetByPhone(string phone, CancellationToken ct)
    {
        var client = await _db.Clients
            .FirstOrDefaultAsync(c => c.Phone == phone, ct);
        if (client is null) return NotFound();

        return Ok(MapToDto(client));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateClientRequest request, CancellationToken ct)
    {
        var existing = await _db.Clients.FirstOrDefaultAsync(c => c.Phone == request.Phone, ct);
        if (existing is not null)
            return Conflict(new { message = "Phone number already registered", clientId = existing.Id });

        var qrCode = $"SMS-{Guid.NewGuid():N}"[..20].ToUpperInvariant();

        var client = new Client
        {
            Name = request.Name,
            Phone = request.Phone,
            QrCode = qrCode,
            TotalPoints = 0,
            LifetimePoints = 0,
            TotalSpent = 0,
            LoyaltyRate = _loyaltySettings.NewClientRate,
            ManualCategory = null,
            ComputedCategory = ClientCategory.Nouveau,
            EffectiveCategory = ClientCategory.Nouveau,
            CategoryUpdatedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow
        };

        _db.Clients.Add(client);
        await _db.SaveChangesAsync(ct);

        var welcomePoints = _loyaltySettings.WelcomePoints;
        client.TotalPoints = welcomePoints;
        client.LifetimePoints = welcomePoints;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            ClientId = client.Id,
            PointsChange = welcomePoints,
            Type = LoyaltyTransactionType.Welcome,
            Description = "Welcome bonus",
            BalanceAfter = welcomePoints
        });

        await _db.SaveChangesAsync(ct);

        return CreatedAtAction(nameof(GetById), new { id = client.Id }, MapToDto(client));
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateClientRequest request, CancellationToken ct)
    {
        var client = await _db.Clients.FindAsync([id], ct);
        if (client is null) return NotFound();

        if (request.Name is not null) client.Name = request.Name;
        if (request.Phone is not null) client.Phone = request.Phone;

        await _db.SaveChangesAsync(ct);
        return Ok(MapToDto(client));
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var client = await _db.Clients
            .Include(c => c.LoyaltyTransactions)
            .Include(c => c.Sales)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (client is null) return NotFound();

        if (client.Sales.Count != 0)
            return BadRequest(new { message = "Cannot delete client with existing sales. Deactivate instead." });

        _db.LoyaltyTransactions.RemoveRange(client.LoyaltyTransactions);
        _db.Clients.Remove(client);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }

    [HttpPost("{id:int}/adjust-points")]
    public async Task<IActionResult> AdjustPoints(int id, [FromBody] AdjustPointsRequest request, CancellationToken ct)
    {
        var client = await _db.Clients.FindAsync([id], ct);
        if (client is null) return NotFound();

        client.TotalPoints += request.Points;
        if (request.Points > 0) client.LifetimePoints += request.Points;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            ClientId = client.Id,
            PointsChange = request.Points,
            Type = LoyaltyTransactionType.Adjust,
            Description = request.Reason ?? "Manual adjustment",
            BalanceAfter = client.TotalPoints
        });

        await _db.SaveChangesAsync(ct);
        return Ok(MapToDto(client));
    }

    [HttpPost("redeem")]
    public async Task<IActionResult> RedeemPoints([FromBody] RedeemPointsRequest request, CancellationToken ct)
    {
        var client = await _db.Clients.FindAsync([request.ClientId], ct);
        if (client is null) return NotFound();

        if (client.TotalPoints < request.Points)
            return BadRequest(new { message = "Insufficient points", available = client.TotalPoints });

        client.TotalPoints -= request.Points;

        _db.LoyaltyTransactions.Add(new LoyaltyTransaction
        {
            ClientId = client.Id,
            SaleId = request.SaleId,
            PointsChange = -request.Points,
            Type = LoyaltyTransactionType.Redeem,
            Description = $"Redeemed for ${request.DiscountAmount:F2} discount",
            BalanceAfter = client.TotalPoints
        });

        await _db.SaveChangesAsync(ct);
        return Ok(new { pointsRedeemed = request.Points, discountAmount = request.DiscountAmount, remainingPoints = client.TotalPoints });
    }

    [HttpPost("{id:int}/category")]
    public async Task<IActionResult> SetCategory(int id, [FromBody] SetClientCategoryRequest request, CancellationToken ct)
    {
        try
        {
            var client = await _categoryService.SetManualCategoryAsync(id, request.Category, request.Reason, ct);
            return Ok(MapToDto(client));
        }
        catch (KeyNotFoundException)
        {
            return NotFound();
        }
    }

    [HttpPost("recalculate-categories")]
    public async Task<IActionResult> RecalculateCategories(CancellationToken ct)
    {
        var count = await _categoryService.RecategorizeAllAsync(ct);
        return Ok(new { recalculated = count });
    }

    private static ClientDto MapToDto(Client c) => new()
    {
        Id = c.Id,
        Name = c.Name,
        Phone = c.Phone,
        QrCode = c.QrCode,
        TotalPoints = c.TotalPoints,
        LifetimePoints = c.LifetimePoints,
        TotalSpent = c.TotalSpent,
        VisitCount = c.Sales.Count,
        LoyaltyRate = c.LoyaltyRate,
        CreatedAt = c.CreatedAt,
        LastVisitAt = c.LastVisitAt,
        EffectiveCategory = c.EffectiveCategory,
        ManualCategory = c.ManualCategory,
        ComputedCategory = c.ComputedCategory,
        CategoryUpdatedAt = c.CategoryUpdatedAt,
        RecentTransactions = c.LoyaltyTransactions.Select(t => new LoyaltyTransactionDto
        {
            Id = t.Id,
            PointsChange = t.PointsChange,
            Type = t.Type.ToString(),
            Description = t.Description,
            BalanceAfter = t.BalanceAfter,
            CreatedAt = t.CreatedAt
        }).ToList()
    };
}
