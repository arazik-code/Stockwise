using Microsoft.AspNetCore.Mvc;
using SMS.Domain.Exceptions;

namespace SMS.API.Middleware;

public class ExceptionHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;

    public ExceptionHandlingMiddleware(RequestDelegate next, ILogger<ExceptionHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (InsufficientStockException ex)
        {
            _logger.LogWarning(ex, "Insufficient stock");
            context.Response.StatusCode = 409;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = 409,
                Title = "Stock insuffisant",
                Detail = ex.Message,
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.10"
            });
        }
        catch (KeyNotFoundException ex)
        {
            _logger.LogWarning(ex, "Resource not found");
            context.Response.StatusCode = 404;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = 404,
                Title = "Introuvable",
                Detail = ex.Message,
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.5"
            });
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "Bad request");
            context.Response.StatusCode = 400;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = 400,
                Title = "Requête invalide",
                Detail = ex.Message,
                Type = "https://tools.ietf.org/html/rfc9110#section-15.5.1"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception");
            context.Response.StatusCode = 500;
            await context.Response.WriteAsJsonAsync(new ProblemDetails
            {
                Status = 500,
                Title = "Erreur interne du serveur",
                Detail = "Une erreur inattendue s'est produite",
                Type = "https://tools.ietf.org/html/rfc9110#section-15.6.1"
            });
        }
    }
}
