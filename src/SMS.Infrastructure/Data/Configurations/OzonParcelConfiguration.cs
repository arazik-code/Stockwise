using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class OzonParcelConfiguration : IEntityTypeConfiguration<OzonParcel>
{
    public void Configure(EntityTypeBuilder<OzonParcel> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.TrackingNumber).IsRequired().HasMaxLength(60);
        builder.Property(p => p.Receiver).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Phone).IsRequired().HasMaxLength(30);
        builder.Property(p => p.CityName).HasMaxLength(120);
        builder.Property(p => p.Address).IsRequired().HasMaxLength(500);
        builder.Property(p => p.Note).HasMaxLength(500);
        builder.Property(p => p.Nature).HasMaxLength(200);
        builder.Property(p => p.StatusText).HasMaxLength(120);
        builder.Property(p => p.DeliveryNoteRef).HasMaxLength(60);

        builder.Property(p => p.Price).HasPrecision(18, 2);
        builder.Property(p => p.DeliveredPrice).HasPrecision(18, 2);
        builder.Property(p => p.ReturnedPrice).HasPrecision(18, 2);
        builder.Property(p => p.RefusedPrice).HasPrecision(18, 2);

        builder.HasIndex(p => p.TrackingNumber).IsUnique();
        builder.HasIndex(p => p.Status);
        builder.HasIndex(p => p.OnlineOrderId);
        builder.HasIndex(p => p.DeliveryNoteRef);

        builder.HasOne(p => p.OnlineOrder)
            .WithMany()
            .HasForeignKey(p => p.OnlineOrderId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
