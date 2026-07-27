using SMS.Application.DTOs.Sales;
using SMS.Application.Validators;
using SMS.Domain.Enums;

namespace SMS.Application.Tests.Validators;

public class CreateSaleValidatorTests
{
    private readonly CreateSaleValidator _validator = new();

    [Fact]
    public async Task Validate_ValidRequest_ShouldPass()
    {
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 2, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        var result = await _validator.ValidateAsync(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_EmptyItems_ShouldFail()
    {
        var request = new CreateSaleRequest
        {
            Items = [],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Items");
    }

    [Fact]
    public async Task Validate_InvalidProductVariantId_ShouldFail()
    {
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 0, Quantity = 1, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Items[0].ProductVariantId");
    }

    [Fact]
    public async Task Validate_ZeroQuantity_ShouldFail()
    {
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 0, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Items[0].Quantity");
    }

    [Fact]
    public async Task Validate_NegativeDiscount_ShouldFail()
    {
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = -5 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = 0.1m
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Items[0].DiscountAmount");
    }

    [Fact]
    public async Task Validate_NegativeAmountPaid_ShouldFail()
    {
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = -10m,
            TaxRate = 0.1m
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "AmountPaid");
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(1.1)]
    public async Task Validate_InvalidTaxRate_ShouldFail(double taxRate)
    {
        var request = new CreateSaleRequest
        {
            Items = [new SaleItemRequest { ProductVariantId = 1, Quantity = 1, DiscountAmount = 0 }],
            PaymentMethod = PaymentMethod.Cash,
            AmountPaid = 100m,
            TaxRate = (decimal)taxRate
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "TaxRate");
    }
}
