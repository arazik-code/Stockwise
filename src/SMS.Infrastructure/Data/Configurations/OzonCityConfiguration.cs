using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class OzonCityConfiguration : IEntityTypeConfiguration<OzonCity>
{
    public void Configure(EntityTypeBuilder<OzonCity> builder)
    {
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever(); // OzonExpress's own city ID

        builder.Property(c => c.Ref).HasMaxLength(20);
        builder.Property(c => c.Name).IsRequired().HasMaxLength(120);
        builder.Property(c => c.DeliveredPrice).HasPrecision(18, 2);
        builder.Property(c => c.ReturnedPrice).HasPrecision(18, 2);
        builder.Property(c => c.RefusedPrice).HasPrecision(18, 2);

        builder.HasIndex(c => c.Name);
    }
}

public class OzonDeliveryNoteConfiguration : IEntityTypeConfiguration<OzonDeliveryNote>
{
    public void Configure(EntityTypeBuilder<OzonDeliveryNote> builder)
    {
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Ref).IsRequired().HasMaxLength(60);
        builder.HasIndex(d => d.Ref).IsUnique();
    }
}
