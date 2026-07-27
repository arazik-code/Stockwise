using SMS.Domain.Exceptions;

namespace SMS.Domain.Tests.Exceptions;

public class ExceptionTests
{
    [Fact]
    public void InsufficientStockException_SetsProperties()
    {
        var exception = new InsufficientStockException(productId: 1, requested: 10, available: 5);

        Assert.Equal(1, exception.ProductId);
        Assert.Equal(10, exception.RequestedQuantity);
        Assert.Equal(5, exception.AvailableQuantity);
    }

    [Fact]
    public void InsufficientStockException_HasCorrectMessage()
    {
        var exception = new InsufficientStockException(productId: 42, requested: 10, available: 3);

        Assert.Contains("42", exception.Message);
        Assert.Contains("10", exception.Message);
        Assert.Contains("3", exception.Message);
    }

    [Fact]
    public void InsufficientStockException_IsException()
    {
        var exception = new InsufficientStockException(1, 10, 5);

        Assert.IsAssignableFrom<Exception>(exception);
    }

    [Fact]
    public void InsufficientStockException_CanBeCaught()
    {
        try
        {
            throw new InsufficientStockException(1, 10, 5);
        }
        catch (InsufficientStockException ex)
        {
            Assert.Equal(1, ex.ProductId);
        }
    }

    [Fact]
    public void DuplicateShopifyOrderException_SetsProperties()
    {
        var exception = new DuplicateShopifyOrderException(shopifyOrderId: 12345);

        Assert.Equal(12345, exception.ShopifyOrderId);
    }

    [Fact]
    public void DuplicateShopifyOrderException_HasCorrectMessage()
    {
        var exception = new DuplicateShopifyOrderException(shopifyOrderId: 99999);

        Assert.Contains("99999", exception.Message);
    }

    [Fact]
    public void DuplicateShopifyOrderException_IsException()
    {
        var exception = new DuplicateShopifyOrderException(12345);

        Assert.IsAssignableFrom<Exception>(exception);
    }

    [Fact]
    public void DuplicateShopifyOrderException_CanBeCaught()
    {
        try
        {
            throw new DuplicateShopifyOrderException(12345);
        }
        catch (DuplicateShopifyOrderException ex)
        {
            Assert.Equal(12345, ex.ShopifyOrderId);
        }
    }
}
