namespace SMS.Application.DTOs.Admin;

public record BackupFileDto(string FileName, long SizeBytes, DateTime CreatedAtUtc, string Kind);

public record CreateBackupResultDto(bool Success, string Message, BackupFileDto? Backup);

public record OperationResultDto(bool Success, string Message);

public record RestoreBackupRequest(string Password);

public record ResetSystemRequest(string Password, string Confirmation);
