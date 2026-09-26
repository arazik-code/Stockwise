using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class SaleRepository : Repository<Sale>, ISaleRepository
{
    public SaleRepository(AppDbContext context) : base(context) { }

    public async Task<IReadOnlyList<Sale>> GetByDateRangeAsync(DateTime from, DateTime to, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .Include(s => s.Client)
            .Include(s => s.User)
            .Include(s => s.ReceiptBarcodes)
            .Where(s => s.CreatedAt >= from && s.CreatedAt <= to)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

    public async Task<IReadOnlyList<Sale>> GetByChannelAsync(SaleChannel channel, CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .Include(s => s.Client)
            .Include(s => s.User)
            .Include(s => s.ReceiptBarcodes)
            .Where(s => s.Channel == channel)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

    public async Task<Sale?> GetWithItemsAsync(int id, CancellationToken ct = default)
        => await _dbSet
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .Include(s => s.Client)
            .Include(s => s.User)
            .Include(s => s.ReceiptBarcodes)
            .FirstOrDefaultAsync(s => s.Id == id, ct);

    public async Task<string> GenerateSaleNumberAsync(CancellationToken ct = default)
    {
        var today = DateTime.UtcNow.ToString("yyyyMMdd");
        var count = await _dbSet.CountAsync(s => s.SaleNumber.StartsWith($"POS-{today}"), ct);
        return $"POS-{today}-{(count + 1):D3}";
    }

    public override async Task<IReadOnlyList<Sale>> GetAllAsync(CancellationToken ct = default)
        => await _dbSet
            .AsNoTracking()
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
            .Include(s => s.ReceiptBarcodes)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);

    public async Task<ReceiptBarcode?> GetReceiptBarcodeAsync(string barcode, CancellationToken ct = default)
        => await _context.ReceiptBarcodes
            .Include(rb => rb.Sale)
            .FirstOrDefaultAsync(rb => rb.Barcode == barcode, ct);

    public ReceiptBarcode GenerateReceiptBarcode(int saleId)
    {
        var today = DateTime.UtcNow.ToString("yyMMdd");
        var seq = saleId % 10000;
        var barcode = $"1{today}{seq:D4}";

        return new ReceiptBarcode
        {
            Barcode = barcode,
            SaleId = saleId,
            IsUsed = false,
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(15)
        };
    }

    public async Task MarkReceiptBarcodeUsedAsync(string barcode, CancellationToken ct = default)
    {
        var rb = await _context.ReceiptBarcodes.FirstOrDefaultAsync(x => x.Barcode == barcode, ct);
        if (rb is not null)
        {
            rb.IsUsed = true;
            await _context.SaveChangesAsync(ct);
        }
    }

    public async Task<IReadOnlyList<Sale>> GetSalesByClientQrCodeAsync(string clientQrCode, DateTime since, CancellationToken ct = default)
    {
        var client = await _context.Clients.FirstOrDefaultAsync(c => c.QrCode == clientQrCode, ct);
        if (client is null) return [];

        return await _dbSet
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Product)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Color)
            .Include(s => s.Items)
            .ThenInclude(si => si.ProductVariant)
            .ThenInclude(pv => pv.Size)
            .Include(s => s.Client)
            .Include(s => s.User)
            .Include(s => s.ReceiptBarcodes)
            .Where(s => s.ClientId == client.Id && s.CreatedAt >= since)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync(ct);
    }
}
