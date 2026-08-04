using SMS.Application.DTOs;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Application.Tests.Services;

public class ClientCategoryEngineTests
{
    [Theory]
    [InlineData(0, ClientCategory.Nouveau)]
    [InlineData(1500, ClientCategory.Nouveau)]   // exactly at the Bon threshold - must exceed it, not just reach it
    [InlineData(1500.01, ClientCategory.Bon)]
    [InlineData(3000, ClientCategory.Bon)]
    [InlineData(5000, ClientCategory.Bon)]       // exactly at the Premium threshold - must exceed it
    [InlineData(5000.01, ClientCategory.Premium)]
    [InlineData(10000, ClientCategory.Premium)]
    public void Determine_AppliesSpendThresholdsCorrectly(decimal spend, ClientCategory expected)
    {
        Assert.Equal(expected, ClientCategoryEngine.Determine(spend));
    }
}

public class LoyaltyRateResolverTests
{
    private readonly LoyaltyRateResolver _resolver = new();
    private readonly LoyaltySettings _settings = new() { NewClientRate = 5, AncientClientRate = 8, PremiumClientRate = 12 };

    [Theory]
    [InlineData(ClientCategory.Nouveau, 5)]
    [InlineData(ClientCategory.Bon, 8)]
    [InlineData(ClientCategory.Premium, 12)]
    public void GetRate_ReturnsRateForEffectiveCategory(ClientCategory category, int expectedRate)
    {
        var client = new Client { EffectiveCategory = category };
        Assert.Equal(expectedRate, _resolver.GetRate(client, _settings));
    }

    [Fact]
    public void GetRate_IgnoresManualCategory_OnlyEffectiveCategoryMatters()
    {
        // ManualCategory alone (without EffectiveCategory having been refreshed to match) must not
        // affect the resolved rate - EffectiveCategory is the single source of truth for earning rate,
        // exactly as it is for every other consumer.
        var client = new Client { ManualCategory = ClientCategory.Premium, EffectiveCategory = ClientCategory.Nouveau };
        Assert.Equal(_settings.NewClientRate, _resolver.GetRate(client, _settings));
    }

    [Fact]
    public void GetRate_ReflectsSettingsChangesImmediately_NoStaleness()
    {
        var client = new Client { EffectiveCategory = ClientCategory.Premium };
        Assert.Equal(12, _resolver.GetRate(client, _settings));

        _settings.PremiumClientRate = 20;

        Assert.Equal(20, _resolver.GetRate(client, _settings));
    }
}
