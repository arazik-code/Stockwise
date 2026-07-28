using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

public class CashDrawerService : ICashDrawerService
{
    private readonly IUnitOfWork _unitOfWork;

    public CashDrawerService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<CashDrawerMovementDto> CreateAsync(int userId, CreateCashDrawerMovementRequest request, CancellationToken ct = default)
    {
        if (request.Amount <= 0)
            throw new ArgumentException("Le montant doit être supérieur à 0");

        var movement = new CashDrawerMovement
        {
            Type = request.Type,
            Amount = request.Amount,
            Reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim(),
            UserId = userId,
            CreatedAt = DateTime.UtcNow
        };

        await _unitOfWork.AddAsync(movement, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var user = (await _unitOfWork.FindAsync<User>(u => u.Id == userId, ct)).FirstOrDefault();
        return MapToDto(movement, user?.FullName ?? "—");
    }

    public async Task<CashDrawerSummaryDto> GetSummaryAsync(int recentCount = 8, CancellationToken ct = default)
    {
        var all = await _unitOfWork.Set<CashDrawerMovement>().ToListAsync(ct);

        var balance = all.Sum(m => m.Type == CashDrawerMovementType.Deposit ? m.Amount : -m.Amount);

        var recent = await _unitOfWork.Set<CashDrawerMovement>()
            .Include(m => m.User)
            .OrderByDescending(m => m.CreatedAt)
            .Take(recentCount)
            .ToListAsync(ct);

        return new CashDrawerSummaryDto(
            balance,
            recent.Select(m => MapToDto(m, m.User?.FullName ?? "—")).ToList());
    }

    private static CashDrawerMovementDto MapToDto(CashDrawerMovement m, string userFullName) =>
        new(m.Id, m.Type, m.Amount, m.Reason, userFullName, m.CreatedAt);
}
