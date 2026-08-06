using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs.Fournisseurs;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[RequireSection(Sections.Fournisseurs)]
public class FournisseursController : ControllerBase
{
    private readonly IFournisseurService _fournisseurService;

    public FournisseursController(IFournisseurService fournisseurService)
    {
        _fournisseurService = fournisseurService;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
        => Ok(await _fournisseurService.GetAllAsync(ct));

    [HttpGet("performance")]
    public async Task<IActionResult> GetPerformance(CancellationToken ct)
        => Ok(await _fournisseurService.GetPerformanceAsync(ct));

    [HttpGet("recommandations")]
    public async Task<IActionResult> GetRecommendations(CancellationToken ct)
        => Ok(await _fournisseurService.GetRecommendationsAsync(ct));

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var fournisseur = await _fournisseurService.GetByIdAsync(id, ct);
        return fournisseur is null ? NotFound() : Ok(fournisseur);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateFournisseurRequest request, CancellationToken ct)
    {
        var fournisseur = await _fournisseurService.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = fournisseur.Id }, fournisseur);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateFournisseurRequest request, CancellationToken ct)
    {
        var fournisseur = await _fournisseurService.UpdateAsync(id, request, ct);
        return fournisseur is null ? NotFound() : Ok(fournisseur);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var fournisseur = await _fournisseurService.GetByIdAsync(id, ct);
        if (fournisseur is null) return NotFound();

        var result = await _fournisseurService.DeleteAsync(id, ct);
        if (result) return NoContent();

        return BadRequest(new { message = "Impossible de supprimer ce fournisseur car il a des produits associés. Veuillez d'abord supprimer ou réaffecter les produits." });
    }

    [HttpPost("{id:int}/receive")]
    public async Task<IActionResult> ReceiveDelivery(int id, [FromBody] ReceiveDeliveryRequest request, CancellationToken ct)
    {
        var result = await _fournisseurService.ReceiveDeliveryAsync(id, request, ct: ct);
        return Ok(result);
    }
}
