using Microsoft.AspNetCore.SignalR;

namespace SMS.Infrastructure.SignalR;

[Microsoft.AspNetCore.Authorization.Authorize]
public class InventoryHub : Hub
{
    public async Task JoinPosRoom()
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, "pos");
    }

    public async Task LeavePosRoom()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, "pos");
    }
}
