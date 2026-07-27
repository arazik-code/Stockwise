using FluentValidation;
using FluentValidation.Results;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SMS.API.Filters;

public class FluentValidationFilter : IAsyncActionFilter
{
    private readonly IServiceProvider _serviceProvider;

    public FluentValidationFilter(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        foreach (var argument in context.ActionArguments)
        {
            if (argument.Value == null) continue;

            var validatorType = typeof(IValidator<>).MakeGenericType(argument.Value.GetType());
            var validator = _serviceProvider.GetService(validatorType) as IValidator;

            if (validator == null) continue;

            var validationResult = await validator.ValidateAsync(
                new ValidationContext<object>(argument.Value));

            if (!validationResult.IsValid)
            {
                var errors = validationResult.Errors
                    .GroupBy(e => e.PropertyName)
                    .ToDictionary(
                        g => g.Key,
                        g => g.Select(e => e.ErrorMessage).ToArray());

                context.Result = new BadRequestObjectResult(new ValidationProblemDetails(errors)
                {
                    Title = "Validation échouée"
                });
                return;
            }
        }

        await next();
    }
}
