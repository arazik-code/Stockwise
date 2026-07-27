namespace SMS.Domain.Entities;

public class Fournisseur
{
    public int Id { get; set; }
    public string Nom { get; set; } = string.Empty;
    public string? Contact { get; set; }
    public string? Email { get; set; }
    public string? Telephone { get; set; }
    public string? Adresse { get; set; }
    public ICollection<Product> Products { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
