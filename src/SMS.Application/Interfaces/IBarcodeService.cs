using SMS.Domain.Entities;

namespace SMS.Application.Interfaces;

public interface IBarcodeService
{
    string GenerateBarcodeValue(Product product);
    byte[] GenerateBarcodeImage(string barcodeValue);
    Task<string> SaveBarcodeImageAsync(string barcodeValue, CancellationToken ct = default);
}
