using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Colors;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Catalog)]
public class ColorsController : ControllerBase
{
    private readonly IColorService _colorService;

    public ColorsController(IColorService colorService)
    {
        _colorService = colorService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _colorService.GetAllAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var color = await _colorService.GetByIdAsync(id, ct);
        return color is null ? NotFound() : Ok(color);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateColorRequest request, CancellationToken ct)
    {
        var color = await _colorService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = color.Id }, color);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateColorRequest request, CancellationToken ct)
    {
        var color = await _colorService.UpdateAsync(id, request, ct);
        return color is null ? NotFound() : Ok(color);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var deleted = await _colorService.DeleteAsync(id, ct);
        return deleted ? NoContent() : NotFound();
    }
}
