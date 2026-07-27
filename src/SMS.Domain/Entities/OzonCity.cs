namespace SMS.Domain.Entities;

// Mirror of OzonExpress's city catalog (used for the city picker and to resolve city names/fees).
public class OzonCity
{
    public int Id { get; set; }               // OzonExpress city ID (natural key)
    public string Ref { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal DeliveredPrice { get; set; }
    public decimal ReturnedPrice { get; set; }
    public decimal RefusedPrice { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
