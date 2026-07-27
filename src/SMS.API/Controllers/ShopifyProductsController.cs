using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.DTOs.Shopify;
using SMS.Application.Interfaces;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/shopify-products")]
[Authorize(Roles = "Admin,StockManager")]
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

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _service.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
