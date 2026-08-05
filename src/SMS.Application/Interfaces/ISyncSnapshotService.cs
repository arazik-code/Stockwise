using SMS.Application.DTOs.Sync;

namespace SMS.Application.Interfaces;

public interface ISyncSnapshotService
{
    Task<SyncSnapshotDto> BuildSnapshotAsync(CancellationToken ct = default);
    Task<SyncApplyResultDto> ApplySnapshotAsync(SyncSnapshotDto snapshot, CancellationToken ct = default);
}
