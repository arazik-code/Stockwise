using SMS.Application.DTOs;
using SMS.Domain.Entities;

namespace SMS.Application.Interfaces;

/// <summary>
/// Resolves the point-earning rate for a client at the moment points are being earned, live from
/// its current EffectiveCategory and the current loyalty settings. Deliberately never reads
/// Client.LoyaltyRate (a denormalized display cache) - a settings change or a category change is
/// reflected on the very next sale with no staleness window on the value that touches money.
/// </summary>
public interface ILoyaltyRateResolver
{
    int GetRate(Client client, LoyaltySettings settings);
}
