using Microsoft.EntityFrameworkCore;
using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
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
        // The register balance is real cash accounting, not just the manual log: cash sales put
        // money in, cash refunds/exchange payouts take it out, and deposits/withdrawals are the
        // manual movements logged here. Only manual movements used to be counted, so taking cash
        // out never actually moved the number - this is what ties it to real sales activity.
        var cashSalesTotal = await _unitOfWork.Set<Sale>()
            .Where(s => s.PaymentMethod == PaymentMethod.Cash)
            .SumAsync(s => s.TotalAmount, ct);

        var cashRefundsTotal = await _unitOfWork.Set<Refund>()
            .Where(r => r.Status == "Completed" && r.Sale != null && r.Sale.PaymentMethod == PaymentMethod.Cash)
            .SumAsync(r => r.PriceDifference, ct);

        var manualMovements = await _unitOfWork.Set<CashDrawerMovement>().ToListAsync(ct);
        var manualNet = manualMovements.Sum(m => m.Type == CashDrawerMovementType.Deposit ? m.Amount : -m.Amount);

        var balance = cashSalesTotal + cashRefundsTotal + manualNet;

        var recent = await _unitOfWork.Set<CashDrawerMovement>()
            .Include(m => m.User)
            .OrderByDescending(m => m.CreatedAt)
            .Take(recentCount)
            .ToListAsync(ct);

        return new CashDrawerSummaryDto(
            balance,
            cashSalesTotal,
            cashRefundsTotal,
            manualNet,
            recent.Select(m => MapToDto(m, m.User?.FullName ?? "—")).ToList());
    }

    private static CashDrawerMovementDto MapToDto(CashDrawerMovement m, string userFullName) =>
        new(m.Id, m.Type, m.Amount, m.Reason, userFullName, m.CreatedAt);
}
