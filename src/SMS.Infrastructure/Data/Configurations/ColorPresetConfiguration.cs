using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ColorPresetConfiguration : IEntityTypeConfiguration<ColorPreset>
{
    public void Configure(EntityTypeBuilder<ColorPreset> builder)
    {
        builder.HasKey(cp => cp.Id);

        builder.Property(cp => cp.Name).IsRequired().HasMaxLength(50);
        builder.Property(cp => cp.HexCode).IsRequired().HasMaxLength(7);
    }
}
