using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/shopify-link")]
[RequireSection(Sections.Shopify)]
public class ShopifyLinkController : ControllerBase
{
    private readonly IShopifyLinkService _service;

    public ShopifyLinkController(IShopifyLinkService service) => _service = service;

    [HttpGet("unlinked")]
    public async Task<IActionResult> GetUnlinked(CancellationToken ct)
        => Ok(await _service.GetUnlinkedVariantsAsync(ct));

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] int limit = 50, CancellationToken ct = default)
        => Ok(await _service.SearchShopifyVariantsAsync(q, limit, ct));

    [HttpGet("{productVariantId:int}/suggestions")]
    public async Task<IActionResult> Suggestions(int productVariantId, CancellationToken ct)
        => Ok(await _service.SuggestForVariantAsync(productVariantId, ct));

    [HttpPost("{productVariantId:int}/link")]
    public async Task<IActionResult> Link(int productVariantId, [FromBody] LinkVariantRequest request, CancellationToken ct)
    {
        var result = await _service.LinkAsync(productVariantId, request.ShopifyVariantId, ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("{productVariantId:int}/unlink")]
    public async Task<IActionResult> Unlink(int productVariantId, CancellationToken ct)
    {
        var result = await _service.UnlinkAsync(productVariantId, ct);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("auto-link")]
    public async Task<IActionResult> AutoLink(CancellationToken ct)
        => Ok(await _service.AutoLinkAsync(ct));
}
