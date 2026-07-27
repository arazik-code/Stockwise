using SMS.Domain.Entities;

namespace SMS.Domain.Tests.Entities;

public class SaleItemTests
{
    [Fact]
    public void SaleItem_DefaultValues_AreCorrect()
    {
        var item = new SaleItem();

        Assert.Equal(0, item.Id);
        Assert.Equal(0, item.SaleId);
        Assert.Equal(0, item.ProductVariantId);
        Assert.Equal(0, item.Quantity);
        Assert.Equal(0m, item.UnitPrice);
        Assert.Equal(0m, item.DiscountAmount);
        Assert.Equal(0m, item.LineTotal);
    }

    [Fact]
    public void SaleItem_LineTotal_CanBeCalculated()
    {
        var item = new SaleItem
        {
            Quantity = 3,
            UnitPrice = 25.50m,
            DiscountAmount = 2.50m,
            LineTotal = 74.00m
        };

        Assert.Equal(74.00m, item.LineTotal);
    }

    [Fact]
    public void SaleItem_HasNavigationProperties()
    {
        var sale = new Sale { Id = 1 };
        var product = new Product { Id = 1, Name = "Test Product" };
        var variant = new ProductVariant { Id = 1, ProductId = 1, Product = product };

        var item = new SaleItem
        {
            SaleId = 1,
            Sale = sale,
            ProductVariantId = 1,
            ProductVariant = variant
        };

        Assert.NotNull(item.Sale);
        Assert.Equal(1, item.Sale.Id);
        Assert.NotNull(item.ProductVariant);
        Assert.Equal(1, item.ProductVariant.ProductId);
    }
}
