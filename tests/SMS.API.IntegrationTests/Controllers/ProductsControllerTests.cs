using System.Net;
using System.Net.Http.Json;
using SMS.Application.DTOs.Products;

namespace SMS.API.IntegrationTests.Controllers;

public class ProductsControllerTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public ProductsControllerTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetAll_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/products");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetById_NonExisting_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/products/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Search_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/products/search?query=test");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Create_ValidRequest_ReturnsCreated()
    {
        var request = new CreateProductRequest
        {
            Name = "Test Product",
            CategoryId = 1
        };

        var response = await _client.PostAsJsonAsync("/api/products", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var product = await response.Content.ReadFromJsonAsync<ProductDto>();
        Assert.NotNull(product);
        Assert.Equal(request.Name, product.Name);
    }

    [Fact]
    public async Task Create_InvalidRequest_ReturnsBadRequest()
    {
        var request = new CreateProductRequest
        {
            Name = "",
            CategoryId = 1
        };

        var response = await _client.PostAsJsonAsync("/api/products", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_NonExisting_ReturnsNotFound()
    {
        var request = new UpdateProductRequest
        {
            Name = "Updated Name"
        };

        var response = await _client.PutAsJsonAsync("/api/products/999", request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Delete_NonExisting_ReturnsNotFound()
    {
        var response = await _client.DeleteAsync("/api/products/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
