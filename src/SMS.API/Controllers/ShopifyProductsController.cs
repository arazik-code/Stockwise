using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/shopify-products")]
[RequireSection(Sections.Shopify)]
public class ShopifyProductsController : ControllerBase
{
    private readonly IShopifyProductService _service;

    public ShopifyProductsController(IShopifyProductService service)
    {
        _service = service;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var mappings = await _service.GetAllAsync(ct);
        return Ok(mappings);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateShopifyProductMappingRequest request, CancellationToken ct)
    {
        var mapping = await _service.CreateAsync(request, ct);
        return Ok(mapping);
    }

    [HttpPost("import")]
    public async Task<IActionResult> Import(CancellationToken ct)
    {
        var result = await _service.ImportFromShopifyAsync(ct);
        return Ok(result);
    }

    [HttpPost("import-catalog")]
    public async Task<IActionResult> ImportCatalog(CancellationToken ct)
    {
        var result = await _service.ImportCatalogFromShopifyAsync(ct);
        return Ok(result);
    }

    [HttpPut("{id:int}/link")]
    public async Task<IActionResult> Link(int id, [FromBody] LinkShopifyProductMappingRequest request, CancellationToken ct)
    {
        var mapping = await _service.LinkAsync(id, request, ct);
        return mapping is null ? NotFound() : Ok(mapping);
    }

    // Group-level operations, keyed by the Shopify PRODUCT rather than one of its variants.
    // The mapping table stores a row per Shopify variant because the inventory push resolves a
    // variant's InventoryItemId through it, but LocalProductId is a product-level pointer - so the
    // UI groups the rows and acts on a whole product at once.
    [HttpPut("by-shopify-product/{shopifyProductId:long}/link")]
    public async Task<IActionResult> LinkByShopifyProduct(
        long shopifyProductId, [FromBody] LinkShopifyProductMappingRequest request, CancellationToken ct)
    {
        var updated = await _service.LinkByShopifyProductAsync(shopifyProductId, request.LocalProductId, ct);
        return updated == 0 ? NotFound() : Ok(new { updated });
    }

    [HttpDelete("by-shopify-product/{shopifyProductId:long}")]
    public async Task<IActionResult> DeleteByShopifyProduct(long shopifyProductId, CancellationToken ct)
    {
        var deleted = await _service.DeleteByShopifyProductAsync(shopifyProductId, ct);
        return deleted == 0 ? NotFound() : Ok(new { deleted });
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
