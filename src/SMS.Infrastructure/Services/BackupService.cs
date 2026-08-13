using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;
using SMS.Application.DTOs.Admin;
using SMS.Application.Interfaces;

namespace SMS.Infrastructure.Services;

/// <summary>
/// Shells out to pg_dump/pg_restore over the internal Docker network (the api container talks to
/// "postgres" by hostname - Postgres's port is never published to the host, see
/// docker-compose.prod.yml) rather than using `docker compose exec`, which would require mounting
/// the Docker socket into this container - a container-escape risk this app has no reason to take
/// on for a backup button. Backups land in a named volume separate from the existing nightly
/// deploy/backup-vps.sh cron dumps on the host - two independent safety nets, not one shared set.
/// </summary>
public class BackupService : IBackupService
{
    private static readonly Regex SafeFileName = new(@"^[a-zA-Z0-9][a-zA-Z0-9_.-]{2,120}\.dump$", RegexOptions.Compiled);

    private readonly IHostEnvironment _env;
    private readonly IHostApplicationLifetime _lifetime;
    private readonly ILogger<BackupService> _logger;
    private readonly string _host;
    private readonly int _port;
    private readonly string _database;
    private readonly string _username;
    private readonly string _password;

    public BackupService(IHostEnvironment env, IConfiguration configuration, IHostApplicationLifetime lifetime, ILogger<BackupService> logger)
    {
        _env = env;
        _lifetime = lifetime;
        _logger = logger;

        var csb = new NpgsqlConnectionStringBuilder(configuration.GetConnectionString("Default"));
        _host = csb.Host ?? "postgres";
        _port = csb.Port is > 0 ? csb.Port : 5432;
        _database = csb.Database ?? "StockManagement";
        _username = csb.Username ?? "postgres";
        _password = csb.Password ?? string.Empty;
    }

    private string BackupDir
    {
        get
        {
            var dir = Path.Combine(_env.ContentRootPath, "backups");
            Directory.CreateDirectory(dir);
            return dir;
        }
    }

    public Task<IReadOnlyList<BackupFileDto>> ListAsync(CancellationToken ct = default)
    {
        var files = Directory.EnumerateFiles(BackupDir, "*.dump")
            .Select(path => new FileInfo(path))
            .OrderByDescending(f => f.LastWriteTimeUtc)
            .Select(f => new BackupFileDto(f.Name, f.Length, f.LastWriteTimeUtc, KindFromFileName(f.Name)))
            .ToList();

        return Task.FromResult<IReadOnlyList<BackupFileDto>>(files);
    }

    public async Task<CreateBackupResultDto> CreateBackupAsync(string kind, string actor, CancellationToken ct = default)
    {
        var fileName = $"{kind}_{DateTime.UtcNow:yyyyMMdd_HHmmss}.dump";
        var path = Path.Combine(BackupDir, fileName);

        await LogOperationAsync($"backup:{kind} started by {actor} -> {fileName}", ct);

        var (exitCode, stderr) = await RunPgToolAsync(
            "pg_dump",
            ["-h", _host, "-p", _port.ToString(), "-U", _username, "-d", _database, "-Fc", "-f", path],
            ct);

        if (exitCode != 0)
        {
            if (File.Exists(path)) File.Delete(path);
            _logger.LogError("pg_dump failed (exit {ExitCode}): {Stderr}", exitCode, stderr);
            await LogOperationAsync($"backup:{kind} FAILED: {stderr}", ct);
            return new CreateBackupResultDto(false, "La sauvegarde a échoué. Vérifiez les journaux serveur.", null);
        }

        var info = new FileInfo(path);
        await LogOperationAsync($"backup:{kind} OK -> {fileName} ({info.Length} octets)", ct);
        return new CreateBackupResultDto(true, "Sauvegarde créée avec succès.",
            new BackupFileDto(fileName, info.Length, info.LastWriteTimeUtc, kind));
    }

    public async Task<OperationResultDto> RestoreAsync(string fileName, string actor, CancellationToken ct = default)
    {
        if (!SafeFileName.IsMatch(fileName))
            return new OperationResultDto(false, "Nom de fichier de sauvegarde invalide.");

        var path = Path.Combine(BackupDir, fileName);
        if (Path.GetFileName(path) != fileName || !File.Exists(path))
            return new OperationResultDto(false, "Fichier de sauvegarde introuvable.");

        await LogOperationAsync($"restore started by {actor} <- {fileName}", ct);

        await TerminateOtherConnectionsAsync(ct);

        var (exitCode, stderr) = await RunPgToolAsync(
            "pg_restore",
            ["-h", _host, "-p", _port.ToString(), "-U", _username, "-d", _database,
             "--clean", "--if-exists", "--no-owner", "--exit-on-error", path],
            ct);

        if (exitCode != 0)
        {
            _logger.LogError("pg_restore failed (exit {ExitCode}): {Stderr}", exitCode, stderr);
            await LogOperationAsync($"restore FAILED: {stderr}", ct);
            return new OperationResultDto(false,
                "La restauration a échoué en cours de route - la base de données peut être dans un état partiel. " +
                "Restaurez immédiatement une autre sauvegarde connue avant de continuer.");
        }

        await LogOperationAsync($"restore OK <- {fileName}", ct);
        ScheduleRestart();
        return new OperationResultDto(true,
            "Restauration terminée. Le système redémarre - vous allez être déconnecté, reconnectez-vous dans quelques secondes.");
    }

    public async Task<OperationResultDto> ResetSystemAsync(string actor, CancellationToken ct = default)
    {
        // Never wipe without a fresh, verified escape hatch - abort entirely if the safety
        // backup itself doesn't succeed, rather than proceeding on faith.
        var safety = await CreateBackupAsync("prereset", actor, ct);
        if (!safety.Success)
        {
            await LogOperationAsync($"reset ABORTED by {actor}: safety backup failed", ct);
            return new OperationResultDto(false,
                "Réinitialisation annulée : la sauvegarde de sécurité préalable a échoué. Aucune donnée n'a été modifiée.");
        }

        await LogOperationAsync($"reset started by {actor}, safety backup = {safety.Backup!.FileName}", ct);

        await TerminateOtherConnectionsAsync(ct);

        try
        {
            await using var conn = new NpgsqlConnection(BuildConnectionString());
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "DROP SCHEMA public CASCADE; CREATE SCHEMA public;";
            await cmd.ExecuteNonQueryAsync(ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Schema reset failed");
            await LogOperationAsync($"reset FAILED: {ex.Message} - restore from {safety.Backup.FileName} to recover", ct);
            return new OperationResultDto(false,
                $"La réinitialisation a échoué : {ex.Message}. Une sauvegarde de sécurité ({safety.Backup.FileName}) " +
                "a été créée juste avant - restaurez-la pour revenir à l'état précédent.");
        }

        await LogOperationAsync($"reset OK, schema recreated - restarting to re-migrate and re-seed", ct);
        ScheduleRestart();
        return new OperationResultDto(true,
            "Système réinitialisé. Le système redémarre et recrée la structure de départ - vous allez être " +
            "déconnecté ; reconnectez-vous dans quelques secondes avec le compte admin par défaut (mot de passe à changer immédiatement).");
    }

    private async Task TerminateOtherConnectionsAsync(CancellationToken ct)
    {
        await using var conn = new NpgsqlConnection(BuildConnectionString());
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT pg_terminate_backend(pid) FROM pg_stat_activity " +
            "WHERE datname = current_database() AND pid <> pg_backend_pid();";
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private string BuildConnectionString() => new NpgsqlConnectionStringBuilder
    {
        Host = _host,
        Port = _port,
        Database = _database,
        Username = _username,
        Password = _password,
        // Short timeout: this connection only ever runs a couple of admin statements.
        Timeout = 15,
    }.ToString();

    private async Task<(int ExitCode, string Stderr)> RunPgToolAsync(string toolName, IReadOnlyList<string> args, CancellationToken ct)
    {
        var psi = new ProcessStartInfo(toolName)
        {
            RedirectStandardError = true,
            RedirectStandardOutput = true,
            UseShellExecute = false,
        };
        foreach (var arg in args) psi.ArgumentList.Add(arg);
        psi.Environment["PGPASSWORD"] = _password;

        using var process = new Process { StartInfo = psi };
        process.Start();
        var stderrTask = process.StandardError.ReadToEndAsync(ct);
        var stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        await process.WaitForExitAsync(ct);
        var stderr = await stderrTask;
        await stdoutTask;

        return (process.ExitCode, stderr);
    }

    private async Task LogOperationAsync(string message, CancellationToken ct)
    {
        var line = $"{DateTime.UtcNow:O} {message}{Environment.NewLine}";
        try
        {
            await File.AppendAllTextAsync(Path.Combine(BackupDir, "operations.log"), line, ct);
        }
        catch (Exception ex)
        {
            // The DB-side AuditLog is the primary trail for backup/restore; this file is a
            // belt-and-braces copy that survives a reset wiping AuditLogs itself. Losing it is
            // not worth failing the actual operation over.
            _logger.LogWarning(ex, "Failed to write backup operations log");
        }
    }

    private static string KindFromFileName(string fileName)
    {
        var idx = fileName.IndexOf('_');
        return idx > 0 ? fileName[..idx] : "unknown";
    }

    private void ScheduleRestart()
    {
        _ = Task.Run(async () =>
        {
            await Task.Delay(TimeSpan.FromSeconds(1));
            _logger.LogWarning("Restarting application after destructive backup operation");
            _lifetime.StopApplication();
        });
    }
}
