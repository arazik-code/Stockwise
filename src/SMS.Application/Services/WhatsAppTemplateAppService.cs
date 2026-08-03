using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class WhatsAppTemplateAppService : IWhatsAppTemplateService
{
    private readonly IUnitOfWork _unitOfWork;

    public WhatsAppTemplateAppService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<WhatsAppTemplateDto>> GetAllAsync(CancellationToken ct = default)
    {
        await EnsureSeededAsync(ct);

        var templates = await _unitOfWork.Set<WhatsAppTemplate>()
            .AsNoTracking()
            .OrderByDescending(t => t.IsDefault)
            .ThenBy(t => t.Name)
            .ToListAsync(ct);

        return templates.Select(MapToDto).ToList();
    }

    public async Task<WhatsAppTemplateDto> CreateAsync(SaveWhatsAppTemplateRequest request, CancellationToken ct = default)
    {
        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Le nom du modèle est requis");
        if (string.IsNullOrWhiteSpace(request.Body)) throw new ArgumentException("Le message ne peut pas être vide");

        var template = new WhatsAppTemplate
        {
            Name = name,
            Body = request.Body,
            IsDefault = false,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _unitOfWork.AddAsync(template, ct);
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(template);
    }

    public async Task<WhatsAppTemplateDto?> UpdateAsync(int id, SaveWhatsAppTemplateRequest request, CancellationToken ct = default)
    {
        var template = await _unitOfWork.Set<WhatsAppTemplate>().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is null) return null;

        var name = request.Name.Trim();
        if (string.IsNullOrWhiteSpace(name)) throw new ArgumentException("Le nom du modèle est requis");
        if (string.IsNullOrWhiteSpace(request.Body)) throw new ArgumentException("Le message ne peut pas être vide");

        template.Name = name;
        template.Body = request.Body;
        template.UpdatedAt = DateTime.UtcNow;
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(template);
    }

    public async Task<bool> DeleteAsync(int id, CancellationToken ct = default)
    {
        var template = await _unitOfWork.Set<WhatsAppTemplate>().FirstOrDefaultAsync(t => t.Id == id, ct);
        if (template is null) return false;

        var wasDefault = template.IsDefault;
        _unitOfWork.Remove(template);
        await _unitOfWork.SaveChangesAsync(ct);

        // Never leave zero templates with no default - the send button needs one to preselect.
        if (wasDefault)
        {
            var next = await _unitOfWork.Set<WhatsAppTemplate>().OrderBy(t => t.Id).FirstOrDefaultAsync(ct);
            if (next is not null)
            {
                next.IsDefault = true;
                await _unitOfWork.SaveChangesAsync(ct);
            }
        }

        return true;
    }

    public async Task<WhatsAppTemplateDto?> SetDefaultAsync(int id, CancellationToken ct = default)
    {
        var all = await _unitOfWork.Set<WhatsAppTemplate>().ToListAsync(ct);
        var target = all.FirstOrDefault(t => t.Id == id);
        if (target is null) return null;

        foreach (var t in all) t.IsDefault = t.Id == id;
        await _unitOfWork.SaveChangesAsync(ct);
        return MapToDto(target);
    }

    private async Task EnsureSeededAsync(CancellationToken ct)
    {
        if (await _unitOfWork.Set<WhatsAppTemplate>().AnyAsync(ct)) return;

        // Migrates the two messages that used to be hardcoded in the frontend (whatsapp.ts) into
        // editable, saveable templates - same wording, now with {placeholder} tokens instead of
        // being baked into JS.
        var now = DateTime.UtcNow;
        await _unitOfWork.AddAsync(new WhatsAppTemplate
        {
            Name = "Confirmation (Français)",
            IsDefault = true,
            CreatedAt = now,
            UpdatedAt = now,
            Body = "Bonjour {clientName} 👋\n" +
                   "Ici FlexShoes. Nous souhaitons confirmer votre commande n° {orderNumber} :\n\n" +
                   "{items}\n\n" +
                   "Total : {total} (paiement à la livraison)\n" +
                   "Adresse : {address}\n\n" +
                   "Pouvez-vous confirmer votre commande et l'adresse de livraison ? Merci beaucoup 🙏"
        }, ct);

        await _unitOfWork.AddAsync(new WhatsAppTemplate
        {
            Name = "Confirmation (Darija)",
            IsDefault = false,
            CreatedAt = now,
            UpdatedAt = now,
            Body = "Salam {clientName} 👋\n" +
                   "Ana m3ak mn FlexShoes. Bghina n2akdo m3ak commande dyalk r9m {orderNumber}:\n\n" +
                   "{items}\n\n" +
                   "Total: {total} (khalas 3nd l'livraison)\n" +
                   "L'adresse: {address}\n\n" +
                   "Wach t9dr t2akd liya l commande w l3unwan dyal livraison? Choukran bzaf 🙏"
        }, ct);

        await _unitOfWork.SaveChangesAsync(ct);
    }

    private static WhatsAppTemplateDto MapToDto(WhatsAppTemplate t) =>
        new(t.Id, t.Name, t.Body, t.IsDefault, t.CreatedAt, t.UpdatedAt);
}
