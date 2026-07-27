using FluentValidation;
using SMS.Application.DTOs.Sales;

namespace SMS.Application.Validators;

public class CreateSaleValidator : AbstractValidator<CreateSaleRequest>
{
    public CreateSaleValidator()
    {
        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("La vente doit contenir au moins un article");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductVariantId)
                .GreaterThan(0).WithMessage("L'identifiant du produit est invalide");

            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("La quantité doit être supérieure à 0");

            item.RuleFor(i => i.DiscountAmount)
                .GreaterThanOrEqualTo(0).WithMessage("La remise ne peut pas être négative");
        });

        RuleFor(x => x.AmountPaid)
            .GreaterThanOrEqualTo(0).WithMessage("Le montant payé ne peut pas être négatif");

        RuleFor(x => x.TaxRate)
            .InclusiveBetween(0, 1).WithMessage("Le taux de taxe doit être compris entre 0 et 1");
    }
}
