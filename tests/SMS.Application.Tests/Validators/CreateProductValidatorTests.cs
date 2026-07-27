using SMS.Application.DTOs.Products;
using SMS.Application.Validators;

namespace SMS.Application.Tests.Validators;

public class CreateProductValidatorTests
{
    private readonly CreateProductValidator _validator = new();

    [Fact]
    public async Task Validate_ValidRequest_ShouldPass()
    {
        var request = new CreateProductRequest
        {
            Name = "Running Shoe",
            CategoryId = 1
        };

        var result = await _validator.ValidateAsync(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public async Task Validate_EmptyName_ShouldFail()
    {
        var request = new CreateProductRequest
        {
            Name = "",
            CategoryId = 1
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Name");
    }

    [Fact]
    public async Task Validate_ZeroCategoryId_ShouldFail()
    {
        var request = new CreateProductRequest
        {
            Name = "Running Shoe",
            CategoryId = 0
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "CategoryId");
    }

    [Fact]
    public async Task Validate_NameTooLong_ShouldFail()
    {
        var request = new CreateProductRequest
        {
            Name = new string('A', 201),
            CategoryId = 1
        };

        var result = await _validator.ValidateAsync(request);

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Name");
    }
}
