namespace SMS.Application.Interfaces;

public interface IImageStorageService
{
    Task<string> SaveAsync(Stream fileStream, string fileName, CancellationToken ct = default);
    Task DeleteAsync(string imageUrl);
}
