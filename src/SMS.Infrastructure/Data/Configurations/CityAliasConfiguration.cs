using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class CityAliasConfiguration : IEntityTypeConfiguration<CityAlias>
{
    public void Configure(EntityTypeBuilder<CityAlias> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.RawKey).IsRequired().HasMaxLength(200);
        builder.Property(a => a.CanonicalName).IsRequired().HasMaxLength(120);

        builder.HasIndex(a => a.RawKey).IsUnique();

        builder.HasOne(a => a.OzonCity)
            .WithMany()
            .HasForeignKey(a => a.OzonCityId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
