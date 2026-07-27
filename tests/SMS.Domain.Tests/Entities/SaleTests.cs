using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Domain.Tests.Entities;

public class SaleTests
{
    [Fact]
    public void Sale_DefaultValues_AreCorrect()
    {
        var sale = new Sale();

        Assert.Equal(string.Empty, sale.SaleNumber);
        Assert.Equal(SaleChannel.Local, sale.Channel);
        Assert.Equal(PaymentMethod.Cash, sale.PaymentMethod);
        Assert.Equal(OrderStatus.Pending, sale.Status);
        Assert.Null(sale.Notes);
        Assert.Null(sale.ClientId);
        Assert.Null(sale.Client);
        Assert.Empty(sale.Items);
    }

    [Fact]
    public void Sale_CanSetAllProperties()
    {
        var sale = new Sale
        {
            Id = 1,
            SaleNumber = "POS-20260630-001",
            Channel = SaleChannel.Local,
            PaymentMethod = PaymentMethod.Card,
            SubTotal = 100m,
            TaxAmount = 10m,
            DiscountAmount = 5m,
            TotalAmount = 105m,
            AmountPaid = 110m,
            ChangeGiven = 5m,
            Status = OrderStatus.Delivered,
            Notes = "Test sale",
            UserId = 1,
            ClientId = 1,
            LoyaltyPointsEarned = 10,
            LoyaltyPointsRedeemed = 0,
            LoyaltyDiscountAmount = 0m
        };

        Assert.Equal(1, sale.Id);
        Assert.Equal("POS-20260630-001", sale.SaleNumber);
        Assert.Equal(SaleChannel.Local, sale.Channel);
        Assert.Equal(PaymentMethod.Card, sale.PaymentMethod);
        Assert.Equal(100m, sale.SubTotal);
        Assert.Equal(10m, sale.TaxAmount);
        Assert.Equal(5m, sale.DiscountAmount);
        Assert.Equal(105m, sale.TotalAmount);
        Assert.Equal(110m, sale.AmountPaid);
        Assert.Equal(5m, sale.ChangeGiven);
        Assert.Equal(OrderStatus.Delivered, sale.Status);
    }

    [Fact]
    public void Sale_CanAddItems()
    {
        var sale = new Sale { Id = 1 };
        var item1 = new SaleItem { Id = 1, ProductVariantId = 1, Quantity = 2, UnitPrice = 50m, LineTotal = 100m };
        var item2 = new SaleItem { Id = 2, ProductVariantId = 2, Quantity = 1, UnitPrice = 30m, LineTotal = 30m };

        sale.Items.Add(item1);
        sale.Items.Add(item2);

        Assert.Equal(2, sale.Items.Count);
        Assert.Equal(130m, sale.Items.Sum(i => i.LineTotal));
    }

    [Fact]
    public void Sale_Timestamp_DefaultsToUtcNow()
    {
        var before = DateTime.UtcNow;
        var sale = new Sale();
        var after = DateTime.UtcNow;

        Assert.InRange(sale.CreatedAt, before, after);
    }

    [Theory]
    [InlineData(SaleChannel.Local)]
    [InlineData(SaleChannel.Shopify)]
    public void Sale_SupportsBothChannels(SaleChannel channel)
    {
        var sale = new Sale { Channel = channel };
        Assert.Equal(channel, sale.Channel);
    }

    [Theory]
    [InlineData(PaymentMethod.Cash)]
    [InlineData(PaymentMethod.Card)]
    [InlineData(PaymentMethod.Online)]
    public void Sale_SupportsAllPaymentMethods(PaymentMethod method)
    {
        var sale = new Sale { PaymentMethod = method };
        Assert.Equal(method, sale.PaymentMethod);
    }
}
