using System.Net;
using System.Net.Http.Json;
using SMS.Application.DTOs.Online;
using SMS.Domain.Enums;

namespace SMS.API.IntegrationTests.Controllers;

public class OnlineOrdersControllerTests : IClassFixture<SmsWebApplicationFactory>
{
    private readonly HttpClient _client;

    public OnlineOrdersControllerTests(SmsWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetAll_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/online-orders");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetById_NonExisting_ReturnsNotFound()
    {
        var response = await _client.GetAsync("/api/online-orders/999");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetDashboard_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/online-orders/dashboard");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dashboard = await response.Content.ReadFromJsonAsync<OnlineDashboardDto>();
        Assert.NotNull(dashboard);
    }

    [Fact]
    public async Task GetConflicts_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/online-orders/conflicts");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Create_EmptyItems_ReturnsBadRequest()
    {
        var request = new CreateManualOrderRequest
        {
            CustomerName = "Test Customer",
            Items = []
        };

        var response = await _client.PostAsJsonAsync("/api/online-orders", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Create_NonExistingVariant_ReturnsNotFound()
    {
        var request = new CreateManualOrderRequest
        {
            CustomerName = "Test Customer",
            Items = [new CreateOnlineOrderItemRequest { ProductVariantId = 999, Quantity = 1 }]
        };

        var response = await _client.PostAsJsonAsync("/api/online-orders", request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateStatus_NonExisting_ReturnsNotFound()
    {
        var request = new UpdateOrderStatusRequest { Status = OrderStatus.Confirmed };

        var response = await _client.PutAsJsonAsync("/api/online-orders/999/status", request);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Cancel_NonExisting_ReturnsNotFound()
    {
        var response = await _client.PostAsJsonAsync("/api/online-orders/999/cancel", new CancelOrderRequest());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
