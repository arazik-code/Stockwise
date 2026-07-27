using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class SizePresetConfiguration : IEntityTypeConfiguration<SizePreset>
{
    public void Configure(EntityTypeBuilder<SizePreset> builder)
    {
        builder.HasKey(sp => sp.Id);

        builder.Property(sp => sp.Value).IsRequired().HasMaxLength(10);
    }
}
