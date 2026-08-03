namespace SMS.Application.DTOs;

public record WhatsAppTemplateDto(int Id, string Name, string Body, bool IsDefault, DateTime CreatedAt, DateTime UpdatedAt);

public record SaveWhatsAppTemplateRequest(string Name, string Body);
