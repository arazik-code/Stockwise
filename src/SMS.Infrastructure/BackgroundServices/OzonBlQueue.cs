using System.Threading.Channels;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.BackgroundServices;

public class OzonBlQueue : IOzonBlQueue
{
    private readonly Channel<string> _channel = Channel.CreateUnbounded<string>(new UnboundedChannelOptions
    {
        SingleReader = true,
        SingleWriter = false
    });

    public void Enqueue(string trackingNumber) => _channel.Writer.TryWrite(trackingNumber);

    public IAsyncEnumerable<string> DequeueAllAsync(CancellationToken ct) => _channel.Reader.ReadAllAsync(ct);
}
