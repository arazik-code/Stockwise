using SMS.Application.DTOs;

namespace SMS.Application.Interfaces;

public interface IWhatsAppTemplateService
{
    Task<IReadOnlyList<WhatsAppTemplateDto>> GetAllAsync(CancellationToken ct = default);
    Task<WhatsAppTemplateDto> CreateAsync(SaveWhatsAppTemplateRequest request, CancellationToken ct = default);
    Task<WhatsAppTemplateDto?> UpdateAsync(int id, SaveWhatsAppTemplateRequest request, CancellationToken ct = default);
    Task<bool> DeleteAsync(int id, CancellationToken ct = default);
    Task<WhatsAppTemplateDto?> SetDefaultAsync(int id, CancellationToken ct = default);
}
