using SMS.Application.DTOs.Admin;

namespace SMS.Application.Interfaces;

/// <summary>
/// Database backup/restore/factory-reset for the Admin dashboard's "Sauvegarde &amp; Restauration"
/// panel. Every API key, Shopify/Ozon credential, JWT secret and DB password lives exclusively in
/// environment variables / appsettings - never in the database - so nothing here needs to
/// selectively preserve rows: any operation that only touches the database is automatically
/// credential-safe.
/// </summary>
public interface IBackupService
{
    Task<IReadOnlyList<BackupFileDto>> ListAsync(CancellationToken ct = default);

    Task<CreateBackupResultDto> CreateBackupAsync(string kind, string actor, CancellationToken ct = default);

    /// <summary>
    /// Drops and recreates every object in the database from the given backup file, then
    /// gracefully restarts the process so EF Core's connection pool and every background
    /// service reconnect against the restored state instead of stale cached state.
    /// </summary>
    Task<OperationResultDto> RestoreAsync(string fileName, string actor, CancellationToken ct = default);

    /// <summary>
    /// Takes an automatic safety backup, then wipes the entire database back to a fresh-install
    /// state (same schema, re-seeded roles/default accounts, zero business data) and gracefully
    /// restarts. Aborts without touching anything if the safety backup itself fails.
    /// </summary>
    Task<OperationResultDto> ResetSystemAsync(string actor, CancellationToken ct = default);
}
