using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Domain.Tests.Entities;

public class StockMovementTests
{
    [Fact]
    public void StockMovement_DefaultValues_AreCorrect()
    {
        var movement = new StockMovement();

        Assert.Equal(0, movement.Id);
        Assert.Equal(0, movement.ProductVariantId);
        Assert.Equal(StockMovementType.Sale, movement.Type);
        Assert.Equal(0, movement.QuantityChange);
        Assert.Equal(0, movement.QuantityAfter);
        Assert.Null(movement.Reference);
        Assert.Null(movement.Notes);
        Assert.Null(movement.UserId);
        Assert.Null(movement.User);
    }

    [Fact]
    public void StockMovement_CanSetAllProperties()
    {
        var movement = new StockMovement
        {
            Id = 1,
            ProductVariantId = 1,
            Type = StockMovementType.Adjustment,
            QuantityChange = -5,
            QuantityAfter = 45,
            Reference = "ADJ-001",
            Notes = "Manual adjustment",
            UserId = 1
        };

        Assert.Equal(1, movement.Id);
        Assert.Equal(StockMovementType.Adjustment, movement.Type);
        Assert.Equal(-5, movement.QuantityChange);
        Assert.Equal(45, movement.QuantityAfter);
        Assert.Equal("ADJ-001", movement.Reference);
        Assert.Equal("Manual adjustment", movement.Notes);
    }

    [Fact]
    public void StockMovement_Timestamp_DefaultsToUtcNow()
    {
        var before = DateTime.UtcNow;
        var movement = new StockMovement();
        var after = DateTime.UtcNow;

        Assert.InRange(movement.CreatedAt, before, after);
    }

    [Theory]
    [InlineData(StockMovementType.Sale)]
    [InlineData(StockMovementType.Return)]
    [InlineData(StockMovementType.Adjustment)]
    [InlineData(StockMovementType.Initial)]
    [InlineData(StockMovementType.ShopifySync)]
    [InlineData(StockMovementType.Purchase)]
    public void StockMovement_SupportsAllMovementTypes(StockMovementType type)
    {
        var movement = new StockMovement { Type = type };
        Assert.Equal(type, movement.Type);
    }
}
