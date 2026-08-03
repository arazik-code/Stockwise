namespace SMS.Domain.Entities;

// User-editable, saveable message templates for the WhatsApp confirmation button in the Orders
// section. Placeholders ({clientName}, {orderNumber}, {items}, {total}, {address}, {storeName})
// are substituted client-side when a template is sent.
public class WhatsAppTemplate
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Body { get; set; } = string.Empty;
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
