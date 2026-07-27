using FluentValidation;
using SMS.Application.DTOs.Products;

namespace SMS.Application.Validators;

public class CreateProductValidator : AbstractValidator<CreateProductRequest>
{
    public CreateProductValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Le nom est requis")
            .MaximumLength(200).WithMessage("Le nom ne doit pas dépasser 200 caractères");

        RuleFor(x => x.CategoryId)
            .GreaterThan(0).WithMessage("La catégorie est requise");
    }
}
