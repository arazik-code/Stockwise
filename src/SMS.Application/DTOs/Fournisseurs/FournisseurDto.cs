namespace SMS.Application.DTOs.Fournisseurs;

public record FournisseurDto(int Id, string Nom, string? Contact, string? Email, string? Telephone, string? Adresse, int ProduitsCount);
public record CreateFournisseurRequest(string Nom, string? Contact, string? Email, string? Telephone, string? Adresse);
public record UpdateFournisseurRequest(string? Nom, string? Contact, string? Email, string? Telephone, string? Adresse);

public class ReceiveDeliveryItemRequest
{
    public int ProductVariantId { get; set; }
    public int Quantity { get; set; }
}

public class ReceiveDeliveryRequest
{
    public string? Reference { get; set; }
    public string? Notes { get; set; }
    public List<ReceiveDeliveryItemRequest> Items { get; set; } = [];
}

public record ReceiveDeliveryResponse(int ItemsReceived, int TotalQuantityAdded);
