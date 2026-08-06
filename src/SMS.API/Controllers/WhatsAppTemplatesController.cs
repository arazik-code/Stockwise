using Microsoft.AspNetCore.Mvc;
using SMS.API.Authorization;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Constants;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/whatsapp-templates")]
[RequireSection(Sections.WhatsApp)]
public class WhatsAppTemplatesController : ControllerBase
{
    private readonly IWhatsAppTemplateService _service;

    public WhatsAppTemplatesController(IWhatsAppTemplateService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct) => Ok(await _service.GetAllAsync(ct));

    // Anyone who can see the templates can create/edit them - these are shared shop-wide message
    // presets, not per-user preferences, and gatekeeping them behind Admin would just mean every
    // wording tweak needs the owner personally.
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] SaveWhatsAppTemplateRequest request, CancellationToken ct)
    {
        try { return Ok(await _service.CreateAsync(request, ct)); }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] SaveWhatsAppTemplateRequest request, CancellationToken ct)
    {
        try
        {
            var result = await _service.UpdateAsync(id, request, ct);
            return result is null ? NotFound() : Ok(result);
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
        => await _service.DeleteAsync(id, ct) ? NoContent() : NotFound();

    [HttpPost("{id:int}/set-default")]
    public async Task<IActionResult> SetDefault(int id, CancellationToken ct)
    {
        var result = await _service.SetDefaultAsync(id, ct);
        return result is null ? NotFound() : Ok(result);
    }
}
