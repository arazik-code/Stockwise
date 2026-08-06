using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasKey(a => a.Id);
        builder.Property(a => a.ActorUsername).IsRequired().HasMaxLength(50);
        builder.Property(a => a.Action).IsRequired().HasMaxLength(100);
        builder.Property(a => a.TargetType).IsRequired().HasMaxLength(50);
        builder.Property(a => a.TargetId).HasMaxLength(50);
        builder.Property(a => a.Details).HasMaxLength(2000);
        builder.HasIndex(a => a.CreatedAt);
    }
}
