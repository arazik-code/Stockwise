namespace SMS.Application.DTOs.Fournisseurs;

public class FournisseurPerformanceDto
{
    public int Id { get; set; }
    public string Nom { get; set; } = string.Empty;
    public decimal RevenuTotal { get; set; }
    public decimal BeneficeTotal { get; set; }
    public int UnitesVendues { get; set; }
    public decimal MargePct { get; set; }
    public decimal TauxEcoulement { get; set; }
    public decimal RotationStock { get; set; }
    public List<TopProductFournisseurDto> TopProduits { get; set; } = [];
    public string Tendance { get; set; } = "stable";
    public string ActionRecommendee { get; set; } = string.Empty;
    public decimal BalanceImpayee { get; set; }
}

public class TopProductFournisseurDto
{
    public int ProductId { get; set; }
    public string ProductName { get; set; } = string.Empty;
    public int QuantiteVendue { get; set; }
    public decimal Revenu { get; set; }
}

public class FournisseurRecommendationDto
{
    public int FournisseurId { get; set; }
    public string Nom { get; set; } = string.Empty;
    public decimal Score { get; set; }
    public List<string> Raisons { get; set; } = [];
}
