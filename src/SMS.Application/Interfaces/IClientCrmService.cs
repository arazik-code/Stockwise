using SMS.Application.DTOs.Crm;

namespace SMS.Application.Interfaces;

public interface IClientCrmService
{
    Task<CrmDashboardDto> GetDashboardAsync(CancellationToken ct = default);
    Task<CrmAnalyticsDto> GetCrmAnalyticsAsync(CancellationToken ct = default);
    Task<ClientAnalyticsDto?> GetClientAnalyticsAsync(int clientId, CancellationToken ct = default);
    Task<ShopifyClientImportResultDto> ImportClientsFromShopifyAsync(CancellationToken ct = default);
}
