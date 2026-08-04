using SMS.Application.DTOs;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Application.Tests.Services;

public class ClientCategoryEngineTests
{
    [Theory]
    [InlineData(0, 0, ClientCategory.Nouveau)]
    [InlineData(1199, 2, ClientCategory.Nouveau)]
    [InlineData(1200, 0, ClientCategory.Bon)] // spend threshold, exact boundary
    [InlineData(0, 3, ClientCategory.Bon)]    // order-count threshold, exact boundary
    [InlineData(3999, 5, ClientCategory.Bon)]
    [InlineData(4000, 0, ClientCategory.Premium)] // spend threshold, exact boundary
    [InlineData(0, 6, ClientCategory.Premium)]    // order-count threshold, exact boundary
    [InlineData(10000, 20, ClientCategory.Premium)]
    public void Determine_AppliesThresholdsCorrectly(decimal spend, int orders, ClientCategory expected)
    {
        Assert.Equal(expected, ClientCategoryEngine.Determine(spend, orders));
    }

    [Fact]
    public void Determine_PremiumTakesPriorityOverBon_WhenBothThresholdsMet()
    {
        // Spend alone clears the Bon bar but the order count alone clears Premium - the higher tier wins.
        Assert.Equal(ClientCategory.Premium, ClientCategoryEngine.Determine(1500m, 6));
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
