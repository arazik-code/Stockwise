using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Products;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Products)]
public class ProductsController : ControllerBase
{
    private readonly IProductService _productService;
    private readonly IImageStorageService _imageStorage;

    public ProductsController(IProductService productService, IImageStorageService imageStorage)
    {
        _productService = productService;
        _imageStorage = imageStorage;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var products = await _productService.GetAllAsync(ct);
        return Ok(products);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var product = await _productService.GetByIdAsync(id, ct);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] ProductSearchRequest request, CancellationToken ct)
    {
        var products = await _productService.SearchAsync(request, ct);
        return Ok(products);
    }

    [HttpGet("online-stats")]
    public async Task<IActionResult> GetOnlineStats(CancellationToken ct)
    {
        var stats = await _productService.GetOnlineStatsAsync(ct);
        return Ok(stats);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProductRequest request, CancellationToken ct)
    {
        var product = await _productService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = product.Id }, product);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateProductRequest request, CancellationToken ct)
    {
        var product = await _productService.UpdateAsync(id, request, ct);
        return product is null ? NotFound() : Ok(product);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var result = await _productService.DeleteAsync(id, ct);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("{id:int}/image")]
    public async Task<IActionResult> UploadImage(int id, IFormFile file, CancellationToken ct)
    {
        var product = await _productService.GetByIdAsync(id, ct);
        if (product is null) return NotFound();

        var imageUrl = await _imageStorage.SaveAsync(file.OpenReadStream(), file.FileName, ct);
        await _productService.UpdateAsync(id, new UpdateProductRequest { ImageUrl = imageUrl }, ct);

        return Ok(new { imageUrl });
    }

    [HttpPost("variants")]
    public async Task<IActionResult> AddVariant([FromBody] CreateProductVariantRequest request, CancellationToken ct)
    {
        var variant = await _productService.AddVariantAsync(request, ct);
        return Ok(variant);
    }

    [HttpPut("variants/{variantId:int}")]
    public async Task<IActionResult> UpdateVariant(int variantId, [FromBody] UpdateProductVariantRequest request, CancellationToken ct)
    {
        var variant = await _productService.UpdateVariantAsync(variantId, request, ct);
        return variant is null ? NotFound() : Ok(variant);
    }

    [HttpDelete("variants/{variantId:int}")]
    public async Task<IActionResult> DeleteVariant(int variantId, CancellationToken ct)
    {
        var result = await _productService.DeleteVariantAsync(variantId, ct);
        return result ? NoContent() : NotFound();
    }

    [HttpPost("generate-barcodes")]
    public async Task<IActionResult> GenerateMissingBarcodes(CancellationToken ct)
    {
        var count = await _productService.GenerateMissingBarcodesAsync(ct);
        return Ok(new { generated = count });
    }

    [HttpGet("variants/barcode/{barcode}")]
    [Authorize]
    public async Task<IActionResult> GetVariantByBarcode(string barcode, CancellationToken ct)
    {
        var variant = await _productService.GetVariantByBarcodeAsync(barcode, ct);
        return variant is null ? NotFound() : Ok(variant);
    }

    [HttpGet("barcode/{barcode}")]
    [Authorize]
    public async Task<IActionResult> GetByBarcode(string barcode, CancellationToken ct)
    {
        var product = await _productService.GetByBarcodeAsync(barcode, ct);
        return product is null ? NotFound() : Ok(product);
    }
}
