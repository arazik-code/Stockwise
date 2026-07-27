using SMS.Domain.Entities;

namespace SMS.Domain.Tests.Entities;

public class StockItemTests
{
    [Fact]
    public void QuantityAvailable_WhenNoReserved_ReturnsOnHand()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 100,
            QuantityReserved = 0
        };

        Assert.Equal(100, stockItem.QuantityAvailable);
    }

    [Fact]
    public void QuantityAvailable_WithReserved_ReturnsDifference()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 100,
            QuantityReserved = 30
        };

        Assert.Equal(70, stockItem.QuantityAvailable);
    }

    [Fact]
    public void QuantityAvailable_WhenFullyReserved_ReturnsZero()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 50,
            QuantityReserved = 50
        };

        Assert.Equal(0, stockItem.QuantityAvailable);
    }

    [Fact]
    public void QuantityAvailable_WhenOverReserved_ReturnsNegative()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 10,
            QuantityReserved = 20
        };

        Assert.Equal(-10, stockItem.QuantityAvailable);
    }

    [Fact]
    public void QuantityAvailable_WhenBothZero_ReturnsZero()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 0,
            QuantityReserved = 0
        };

        Assert.Equal(0, stockItem.QuantityAvailable);
    }

    [Fact]
    public void LastUpdatedAt_DefaultsToUtcNow()
    {
        var before = DateTime.UtcNow;
        var stockItem = new StockItem();
        var after = DateTime.UtcNow;

        Assert.InRange(stockItem.LastUpdatedAt, before, after);
    }

    [Fact]
    public void IsLowStock_WhenBelowReorderLevel_ReturnsTrue()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 5,
            ReorderLevel = 10
        };

        Assert.True(stockItem.QuantityOnHand < stockItem.ReorderLevel);
    }

    [Fact]
    public void IsLowStock_WhenAtReorderLevel_ReturnsFalse()
    {
        var stockItem = new StockItem
        {
            QuantityOnHand = 10,
            ReorderLevel = 10
        };

        Assert.False(stockItem.QuantityOnHand < stockItem.ReorderLevel);
    }
}
