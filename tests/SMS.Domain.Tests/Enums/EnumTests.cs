using SMS.Domain.Enums;

namespace SMS.Domain.Tests.Enums;

public class EnumTests
{
    [Fact]
    public void SaleChannel_HasCorrectValues()
    {
        Assert.Equal(0, (int)SaleChannel.Local);
        Assert.Equal(1, (int)SaleChannel.Shopify);
    }

    [Fact]
    public void PaymentMethod_HasCorrectValues()
    {
        Assert.Equal(0, (int)PaymentMethod.Cash);
        Assert.Equal(1, (int)PaymentMethod.Card);
        Assert.Equal(2, (int)PaymentMethod.Online);
    }

    [Fact]
    public void StockMovementType_HasCorrectValues()
    {
        Assert.Equal(0, (int)StockMovementType.Sale);
        Assert.Equal(1, (int)StockMovementType.Return);
        Assert.Equal(2, (int)StockMovementType.Adjustment);
        Assert.Equal(3, (int)StockMovementType.Initial);
        Assert.Equal(4, (int)StockMovementType.ShopifySync);
        Assert.Equal(5, (int)StockMovementType.Purchase);
    }

    [Fact]
    public void OrderStatus_HasCorrectValues()
    {
        Assert.Equal(0, (int)OrderStatus.Pending);
        Assert.Equal(1, (int)OrderStatus.Processing);
        Assert.Equal(2, (int)OrderStatus.Shipped);
        Assert.Equal(3, (int)OrderStatus.Delivered);
        Assert.Equal(4, (int)OrderStatus.Cancelled);
        Assert.Equal(5, (int)OrderStatus.Refunded);
        Assert.Equal(6, (int)OrderStatus.InventoryConflict);
    }

    [Fact]
    public void UserRole_HasCorrectValues()
    {
        Assert.Equal(0, (int)UserRole.Admin);
        Assert.Equal(1, (int)UserRole.Manager);
        Assert.Equal(2, (int)UserRole.Cashier);
    }

    [Fact]
    public void SaleChannel_AllValues_AreDefined()
    {
        var values = Enum.GetValues<SaleChannel>();
        Assert.Equal(2, values.Length);
    }

    [Fact]
    public void PaymentMethod_AllValues_AreDefined()
    {
        var values = Enum.GetValues<PaymentMethod>();
        Assert.Equal(3, values.Length);
    }

    [Fact]
    public void StockMovementType_AllValues_AreDefined()
    {
        var values = Enum.GetValues<StockMovementType>();
        Assert.Equal(7, values.Length);
    }

    [Fact]
    public void OrderStatus_AllValues_AreDefined()
    {
        var values = Enum.GetValues<OrderStatus>();
        Assert.Equal(10, values.Length);
    }

    [Fact]
    public void UserRole_AllValues_AreDefined()
    {
        var values = Enum.GetValues<UserRole>();
        Assert.Equal(4, values.Length);
    }
}
