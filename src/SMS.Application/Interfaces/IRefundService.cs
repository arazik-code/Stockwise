using SMS.Application.DTOs.Refunds;

namespace SMS.Application.Interfaces;

public interface IRefundService
{
    Task<SaleForRefundDto?> GetSaleForRefundAsync(int saleId, CancellationToken ct = default);
    Task<IReadOnlyList<RefundDto>> GetAllAsync(CancellationToken ct = default);
    Task<RefundDto?> GetByIdAsync(int id, CancellationToken ct = default);
    Task<RefundDto> CreateAsync(CreateRefundRequest request, int? processedByUserId, CancellationToken ct = default);
    Task<RefundDto?> ProcessAsync(int id, CancellationToken ct = default);
    Task<RefundDto?> CancelAsync(int id, CancellationToken ct = default);
    Task<IReadOnlyList<ProductVariantForExchangeDto>> SearchVariantsForExchangeAsync(string query, CancellationToken ct = default);
    Task<SaleForRefundDto?> ScanReceiptBarcodeAsync(string barcode, CancellationToken ct = default);
    Task<IReadOnlyList<SaleForRefundDto>> ScanClientQrCodeAsync(string clientQrCode, CancellationToken ct = default);
}
