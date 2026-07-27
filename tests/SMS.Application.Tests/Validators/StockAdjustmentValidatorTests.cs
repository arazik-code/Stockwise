using SMS.Application.DTOs.Stock;
using SMS.Application.Validators;

namespace SMS.Application.Tests.Validators;

public class StockAdjustmentValidatorTests
{
    private readonly StockAdjustmentValidator _validator = new();

    [Fact]
    public async Task Validate_ValidDeltaRequest_ShouldPass()
    {
        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            AdjustmentDelta = 50,
            Notes = "Manual count"
        };

        var result = await _validator.ValidateAsync(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_ValidNewQuantityRequest_ShouldPass()
    {
        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            NewQuantity = 100,
            Notes = "Inventory recount"
        };

        var result = await _validator.ValidateAsync(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_NegativeAdjustmentDelta_ShouldPass()
    {
        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            AdjustmentDelta = -5,
            Notes = "Damaged items"
        };

        var result = await _validator.ValidateAsync(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_NoAdjustmentNorQuantity_ShouldFail()
    {
        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            Notes = "No change specified"
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.ErrorMessage.Contains("ajustement"));
    }

    [Fact]
    public async Task Validate_InvalidProductVariantId_ShouldFail()
    {
        var request = new AdjustStockRequest
        {
            ProductVariantId = 0,
            AdjustmentDelta = 50
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "ProductVariantId");
    }

    [Fact]
    public async Task Validate_NegativeNewQuantity_ShouldFail()
    {
        var request = new AdjustStockRequest
        {
            ProductVariantId = 1,
            NewQuantity = -10
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "NewQuantity");
    }
}
