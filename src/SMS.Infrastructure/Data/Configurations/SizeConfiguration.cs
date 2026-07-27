using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class SizeConfiguration : IEntityTypeConfiguration<Size>
{
    public void Configure(EntityTypeBuilder<Size> builder)
    {
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Value).IsRequired().HasMaxLength(50);
        builder.HasIndex(s => s.Value).IsUnique();
    }
}
