using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Sizes;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Catalog)]
public class SizesController : ControllerBase
{
    private readonly ISizeService _sizeService;

    public SizesController(ISizeService sizeService)
    {
        _sizeService = sizeService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _sizeService.GetAllAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var size = await _sizeService.GetByIdAsync(id, ct);
        return size is null ? NotFound() : Ok(size);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateSizeRequest request, CancellationToken ct)
    {
        var size = await _sizeService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = size.Id }, size);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSizeRequest request, CancellationToken ct)
    {
        var size = await _sizeService.UpdateAsync(id, request, ct);
        return size is null ? NotFound() : Ok(size);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _sizeService.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
