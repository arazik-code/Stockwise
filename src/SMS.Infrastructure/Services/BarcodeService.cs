using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Infrastructure.Data;
using ZXing;
using ZXing.Common;

namespace SMS.Infrastructure.Services;

public class BarcodeService : IBarcodeService
{
    private readonly AppDbContext _db;
    private readonly IHostEnvironment _env;

    public BarcodeService(AppDbContext db, IHostEnvironment env)
    {
        _db = db;
        _env = env;
    }

    public string GenerateBarcodeValue(Product product)
    {
        string candidate;
        do
        {
            candidate = $"2{Random.Shared.Next(1000000, 9999999)}";
        }
        while (_db.ProductVariants.Any(v => v.Barcode == candidate));

        return candidate;
    }

    public byte[] GenerateBarcodeImage(string barcodeValue)
    {
        var writer = new BarcodeWriter<byte[]>
        {
            Format = BarcodeFormat.CODE_128,
            Options = new EncodingOptions
            {
                Width = 300,
                Height = 80,
                Margin = 10,
                PureBarcode = false
            }
        };

        return writer.Write(barcodeValue);
    }

    public async Task<string> SaveBarcodeImageAsync(string barcodeValue, CancellationToken ct = default)
    {
        var barcodesDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "barcodes");
        Directory.CreateDirectory(barcodesDir);

        var safeFileName = string.Join("_", barcodeValue.Split(Path.GetInvalidFileNameChars()));
        var filePath = Path.Combine(barcodesDir, $"{safeFileName}.png");

        if (!File.Exists(filePath))
        {
            var imageBytes = GenerateBarcodeImage(barcodeValue);
            await File.WriteAllBytesAsync(filePath, imageBytes, ct);
        }

        return $"/uploads/barcodes/{safeFileName}.png";
    }
}
