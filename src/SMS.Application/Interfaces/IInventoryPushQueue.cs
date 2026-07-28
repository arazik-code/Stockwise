namespace SMS.Application.Interfaces;

/// <summary>
/// Hands off "this variant's stock changed, tell Shopify" to a background worker.
/// <para>
/// Enqueue is deliberately synchronous and cannot fail: a POS sale must never be slowed down or
/// broken by Shopify being slow or down. This replaces a fire-and-forget <c>_ = SomeAsync(...)</c>
/// call that captured the request's DbContext and CancellationToken - both of which are torn down
/// the moment the HTTP response completes, so the push died silently on every single sale with
/// nothing logged anywhere.
/// </para>
/// </summary>
public interface IInventoryPushQueue
{
    void Enqueue(int productVariantId);
    IAsyncEnumerable<int> DequeueAllAsync(CancellationToken ct);
}
