using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs.Categories;
using SMS.Infrastructure.Data;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin,StockManager")]
public class CategoriesController : ControllerBase
{
    private readonly AppDbContext _db;

    public CategoriesController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var categories = await _db.Categories
            .Include(c => c.SubCategories)
            .Where(c => c.ParentCategoryId == null)
            .OrderBy(c => c.Name)
            .ToListAsync(ct);
        return Ok(categories);
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, CancellationToken ct)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        return category is null ? NotFound() : Ok(category);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryRequest request, CancellationToken ct)
    {
        var category = new SMS.Domain.Entities.Category
        {
            Name = request.Name,
            Description = request.Description,
            ParentCategoryId = request.ParentCategoryId
        };
        _db.Categories.Add(category);
        await _db.SaveChangesAsync(ct);
        return CreatedAtAction(nameof(GetById), new { id = category.Id }, category);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateCategoryRequest request, CancellationToken ct)
    {
        var category = await _db.Categories.FindAsync([id], ct);
        if (category is null) return NotFound();

        if (request.Name is not null) category.Name = request.Name;
        if (request.Description is not null) category.Description = request.Description;
        category.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Ok(category);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        var category = await _db.Categories
            .Include(c => c.Products)
            .FirstOrDefaultAsync(c => c.Id == id, ct);
        if (category is null) return NotFound();
        if (category.Products.Count > 0) return BadRequest("Cannot delete category with products");

        _db.Categories.Remove(category);
        await _db.SaveChangesAsync(ct);
        return NoContent();
    }
}
