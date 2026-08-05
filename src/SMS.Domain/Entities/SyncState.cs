namespace SMS.Domain.Entities;

// Single-row table (only ever one instance exists) tracking when the local-fallback database
// last successfully applied a snapshot from the VPS. Used to detect local activity (stock
// movements, client visits) that happened after that point, so a sync never silently overwrites
// something the local fallback did while the VPS was unreachable - see SyncSnapshotAppService.
public class SyncState
{
    public int Id { get; set; }
    public DateTime? LastSyncedAt { get; set; }
}
