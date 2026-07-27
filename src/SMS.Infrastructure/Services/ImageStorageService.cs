using Microsoft.Extensions.Hosting;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.Services;

public class ImageStorageService : IImageStorageService
{
    private readonly IHostEnvironment _env;
    private static readonly HashSet<string> AllowedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp"
    };
    private const long MaxFileSize = 5 * 1024 * 1024; // 5MB

    public ImageStorageService(IHostEnvironment env)
    {
        _env = env;
    }

    public async Task<string> SaveAsync(Stream fileStream, string fileName, CancellationToken ct = default)
    {
        if (fileStream is null || fileStream.Length == 0)
            throw new ArgumentException("No file provided.");

        if (fileStream.Length > MaxFileSize)
            throw new ArgumentException("File size exceeds 5MB limit.");

        var ext = Path.GetExtension(fileName);
        if (!AllowedExtensions.Contains(ext))
            throw new ArgumentException("Only JPG, PNG, and WEBP files are allowed.");

        var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "products");
        Directory.CreateDirectory(uploadsDir);

        var newFileName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(uploadsDir, newFileName);

        await using var target = new FileStream(filePath, FileMode.Create);
        await fileStream.CopyToAsync(target, ct);

        return $"/uploads/products/{newFileName}";
    }

    public Task DeleteAsync(string imageUrl)
    {
        if (string.IsNullOrWhiteSpace(imageUrl))
            return Task.CompletedTask;

        var fileName = Path.GetFileName(imageUrl);
        var filePath = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "products", fileName);

        if (File.Exists(filePath))
            File.Delete(filePath);

        return Task.CompletedTask;
    }
}
