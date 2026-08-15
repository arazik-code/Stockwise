using System.Net.Http.Json;
using System.Text.Json;
using SMS.Application.DTOs.Colors;
using SMS.Application.DTOs.Products;
using SMS.Application.DTOs.Sizes;

namespace SMS.API.IntegrationTests.Controllers;

/// <summary>
/// End-to-end cover for the colourway tier - the (product x colour) row between Product and
/// ProductVariant that exists because Shopify sells one product per colourway while the shop floor
/// works from a colour x size matrix.
///
/// These go through the real HTTP stack rather than mocking the service, because the thing most
/// likely to break is the repository's include chain: ProductVariant keeps its own ProductId and
/// ColorId next to ColorwayId, and if Colorways is ever dropped from the query the DTO silently
/// comes back with an empty list instead of failing.
/// </summary>
public class ProductColorwayTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ProductColorwayTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    // Colours and sizes are created per test rather than taken from seed data: the test host uses a
    // fresh in-memory database that seeds neither, and creating them here also keeps each test's
    // colourways from colliding with another's on the unique (ProductId, ColorId) index.
    private async Task<(int ColorA, int ColorB, int SizeA, int SizeB)> ReferenceDataAsync()
    {
        var tag = Guid.NewGuid().ToString("N")[..8];
        return (
            await CreateColorAsync($"Noir {tag}"),
            await CreateColorAsync($"Marron {tag}"),
            await CreateSizeAsync($"41 {tag}"),
            await CreateSizeAsync($"42 {tag}"));
    }

    private async Task<int> CreateColorAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/colors",
            new CreateColorRequest { Name = name, HexCode = "#111111" });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ColorDto>())!.Id;
    }

    private async Task<int> CreateSizeAsync(string value)
    {
        var response = await _client.PostAsJsonAsync("/api/sizes",
            new CreateSizeRequest { Value = value });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SizeDto>())!.Id;
    }

    // The category must really exist: Product.CategoryId is non-nullable, so EF treats the
    // Category navigation as required and every Include of it is an inner join. A product pointing
    // at a category that isn't there simply disappears from all read queries.
    private async Task<int> CreateCategoryAsync()
    {
        var response = await _client.PostAsJsonAsync("/api/categories",
            new { Name = "Colourway Cat " + Guid.NewGuid().ToString("N")[..8] });
        response.EnsureSuccessStatusCode();
        var category = await response.Content.ReadFromJsonAsync<JsonElement>();
        return category.GetProperty("id").GetInt32();
    }

    private async Task<int> CreateProductAsync(string name)
    {
        var response = await _client.PostAsJsonAsync("/api/products",
            new CreateProductRequest { Name = name, CategoryId = await CreateCategoryAsync(), Price = 100m });
        response.EnsureSuccessStatusCode();
        var product = await response.Content.ReadFromJsonAsync<ProductDto>();
        Assert.True(product!.Id > 0, "created product came back without an id");
        return product.Id;
    }

    private async Task AddVariantAsync(int productId, int colorId, int sizeId)
    {
        var response = await _client.PostAsJsonAsync("/api/products/variants",
            new CreateProductVariantRequest
            {
                ProductId = productId,
                ColorId = colorId,
                SizeId = sizeId,
                InitialStock = 4,
                ReorderLevel = 1
            });
        response.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task AddingVariants_GroupsThemIntoOneColorwayPerColour()
    {
        var (colorA, colorB, sizeA, sizeB) = await ReferenceDataAsync();
        var productId = await CreateProductAsync("Colourway Grouping " + Guid.NewGuid());

        // A 2-colour x 2-size matrix: four variants, but only two colourways.
        await AddVariantAsync(productId, colorA, sizeA);
        await AddVariantAsync(productId, colorA, sizeB);
        await AddVariantAsync(productId, colorB, sizeA);
        await AddVariantAsync(productId, colorB, sizeB);

        var product = await _client.GetFromJsonAsync<ProductDto>($"/api/products/{productId}");

        Assert.NotNull(product);
        Assert.Equal(4, product.Variants.Count);
        Assert.Equal(2, product.Colorways.Count);
        Assert.Equal([colorA, colorB], product.Colorways.Select(c => c.ColorId).Order());

        // Each colourway reports its own sizes and the stock rolled up across them.
        Assert.All(product.Colorways, c =>
        {
            Assert.Equal(2, c.VariantCount);
            Assert.Equal(8, c.StockQuantity); // 2 sizes x 4 units
            Assert.False(string.IsNullOrWhiteSpace(c.ColorName));
        });

        // Every variant names the colourway that matches its own colour - this is the invariant the
        // composite foreign key enforces at the database level.
        var colorwayByColor = product.Colorways.ToDictionary(c => c.ColorId, c => c.Id);
        Assert.All(product.Variants, v => Assert.Equal(colorwayByColor[v.ColorId], v.ColorwayId));
    }

    [Fact]
    public async Task ProductWithNoShopifyLink_IsNotReportedAsLinked()
    {
        var (colorA, _, sizeA, _) = await ReferenceDataAsync();
        var productId = await CreateProductAsync("Local Only " + Guid.NewGuid());
        await AddVariantAsync(productId, colorA, sizeA);

        var product = await _client.GetFromJsonAsync<ProductDto>($"/api/products/{productId}");

        Assert.NotNull(product);
        Assert.False(product.IsShopifyLinked);
        Assert.Null(Assert.Single(product.Colorways).ShopifyProductId);
    }

    [Fact]
    public async Task ChangingAVariantsColour_RehomesItAndDropsTheEmptiedColorway()
    {
        var (colorA, colorB, sizeA, _) = await ReferenceDataAsync();
        var productId = await CreateProductAsync("Colourway Rehome " + Guid.NewGuid());
        await AddVariantAsync(productId, colorA, sizeA);

        var before = await _client.GetFromJsonAsync<ProductDto>($"/api/products/{productId}");
        var variant = Assert.Single(before!.Variants);
        var originalColorwayId = Assert.Single(before.Colorways).Id;

        var response = await _client.PutAsJsonAsync($"/api/products/variants/{variant.Id}",
            new UpdateProductVariantRequest { ColorId = colorB });
        response.EnsureSuccessStatusCode();

        var after = await _client.GetFromJsonAsync<ProductDto>($"/api/products/{productId}");

        // The variant moved to a new colourway, and the one it left behind - empty and unlinked -
        // is gone rather than lingering as a phantom colour in the POS picker.
        var colorway = Assert.Single(after!.Colorways);
        Assert.Equal(colorB, colorway.ColorId);
        Assert.NotEqual(originalColorwayId, colorway.Id);
        Assert.Equal(colorway.Id, Assert.Single(after.Variants).ColorwayId);
    }
}
