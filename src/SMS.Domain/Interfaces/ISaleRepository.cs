using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Domain.Interfaces;

public interface ISaleRepository : IRepository<Sale>
{
    Task<IReadOnlyList<Sale>> GetByDateRangeAsync(DateTime from, DateTime to, CancellationToken ct = default);
    Task<IReadOnlyList<Sale>> GetByChannelAsync(SaleChannel channel, CancellationToken ct = default);
    Task<Sale?> GetWithItemsAsync(int id, CancellationToken ct = default);
    Task<string> GenerateSaleNumberAsync(CancellationToken ct = default);
    Task<ReceiptBarcode?> GetReceiptBarcodeAsync(string barcode, CancellationToken ct = default);
    ReceiptBarcode GenerateReceiptBarcode(int saleId);
    Task MarkReceiptBarcodeUsedAsync(string barcode, CancellationToken ct = default);
    Task<IReadOnlyList<Sale>> GetSalesByClientQrCodeAsync(string clientQrCode, DateTime since, CancellationToken ct = default);
}
