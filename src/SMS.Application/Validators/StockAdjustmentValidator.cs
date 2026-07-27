using FluentValidation;
using SMS.Application.DTOs.Stock;

namespace SMS.Application.Validators;

public class StockAdjustmentValidator : AbstractValidator<AdjustStockRequest>
{
    public StockAdjustmentValidator()
    {
        RuleFor(x => x.ProductVariantId)
            .GreaterThan(0).WithMessage("L'identifiant du produit est requis");

        RuleFor(x => x)
            .Must(x => x.AdjustmentDelta.HasValue || x.NewQuantity.HasValue)
            .WithMessage("Un ajustement (delta ou quantité exacte) est requis");

        RuleFor(x => x.NewQuantity)
            .GreaterThanOrEqualTo(0)
            .When(x => x.NewQuantity.HasValue)
            .WithMessage("La quantité ne peut pas être négative");
    }
}
