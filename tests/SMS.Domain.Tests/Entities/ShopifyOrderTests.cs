using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Domain.Tests.Entities;

public class ShopifyOrderTests
{
    [Fact]
    public void ShopifyOrder_DefaultValues_AreCorrect()
    {
        var order = new ShopifyOrder();

        Assert.Equal(0, order.Id);
        Assert.Equal(0, order.ShopifyOrderId);
        Assert.Equal(string.Empty, order.OrderNumber);
        Assert.Equal(string.Empty, order.FinancialStatus);
        Assert.Equal(string.Empty, order.FulfillmentStatus);
        Assert.Equal(0m, order.TotalPrice);
        Assert.Equal("USD", order.Currency);
        Assert.Null(order.CustomerEmail);
        Assert.Null(order.CustomerName);
        Assert.Null(order.ShippingAddress);
        Assert.Equal(OrderStatus.Pending, order.LocalStatus);
        Assert.False(order.InventoryDeducted);
        Assert.Empty(order.LineItems);
    }

    [Fact]
    public void ShopifyOrder_CanSetAllProperties()
    {
        var order = new ShopifyOrder
        {
            Id = 1,
            ShopifyOrderId = 123456789,
            OrderNumber = "#1001",
            FinancialStatus = "paid",
            FulfillmentStatus = "fulfilled",
            TotalPrice = 150.00m,
            Currency = "EUR",
            CustomerEmail = "test@example.com",
            CustomerName = "John Doe",
            ShippingAddress = "{\"address1\":\"123 Main St\"}",
            LocalStatus = OrderStatus.Processing,
            InventoryDeducted = true
        };

        Assert.Equal(123456789, order.ShopifyOrderId);
        Assert.Equal("#1001", order.OrderNumber);
        Assert.Equal("paid", order.FinancialStatus);
        Assert.Equal("fulfilled", order.FulfillmentStatus);
        Assert.Equal(150.00m, order.TotalPrice);
        Assert.Equal("EUR", order.Currency);
        Assert.True(order.InventoryDeducted);
    }

    [Fact]
    public void ShopifyOrder_CanAddLineItems()
    {
        var order = new ShopifyOrder { Id = 1 };
        var item1 = new ShopifyOrderLineItem { Id = 1, Title = "Shoe A", Quantity = 2, Price = 50m };
        var item2 = new ShopifyOrderLineItem { Id = 2, Title = "Shoe B", Quantity = 1, Price = 75m };

        order.LineItems.Add(item1);
        order.LineItems.Add(item2);

        Assert.Equal(2, order.LineItems.Count);
    }
}
