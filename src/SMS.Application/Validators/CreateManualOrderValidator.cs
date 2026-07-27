using FluentValidation;
using SMS.Application.DTOs.Online;

namespace SMS.Application.Validators;

public class CreateManualOrderValidator : AbstractValidator<CreateManualOrderRequest>
{
    public CreateManualOrderValidator()
    {
        RuleFor(x => x.CustomerName)
            .NotEmpty().WithMessage("Le nom du client est requis");

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("La commande doit contenir au moins un article");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductVariantId)
                .GreaterThan(0).WithMessage("L'identifiant du produit est invalide");

            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("La quantité doit être supérieure à 0");

            item.RuleFor(i => i.DiscountAmount)
                .GreaterThanOrEqualTo(0).WithMessage("La remise ne peut pas être négative");
        });

        RuleFor(x => x.DeliveryFee)
            .GreaterThanOrEqualTo(0).WithMessage("Les frais de livraison ne peuvent pas être négatifs");

        RuleFor(x => x.DiscountAmount)
            .GreaterThanOrEqualTo(0).WithMessage("La remise ne peut pas être négative");
    }
}
