namespace SMS.Application.Interfaces;

/// <summary>
/// Hands off "create the official OzonExpress BL/label for this tracking number" to a background
/// worker, so parcel creation returns as soon as add-parcel succeeds instead of waiting on 3 more
/// OzonExpress calls plus a hardcoded delay.
/// </summary>
public interface IOzonBlQueue
{
    void Enqueue(string trackingNumber);
    IAsyncEnumerable<string> DequeueAllAsync(CancellationToken ct);
}
