using System.Threading.Channels;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

public class InventoryPushQueue : IInventoryPushQueue
{
    // Unbounded + TryWrite means Enqueue never blocks and never throws, which is the whole point:
    // the caller is inside a POS sale and must not be affected by Shopify at all.
    private readonly Channel<int> _channel = Channel.CreateUnbounded<int>(new UnboundedChannelOptions
    {
        SingleReader = true,
        SingleWriter = false
    });

    public void Enqueue(int productVariantId) => _channel.Writer.TryWrite(productVariantId);

    public IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}
