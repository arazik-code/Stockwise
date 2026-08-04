using SMS.Application.DTOs;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Application.Services;

public class LoyaltyRateResolver : ILoyaltyRateResolver
{
    public int GetRate(Client client, LoyaltySettings settings) => client.EffectiveCategory switch
    {
        ClientCategory.Premium => settings.PremiumClientRate,
        ClientCategory.Bon => settings.AncientClientRate,
        _ => settings.NewClientRate
    };
}
