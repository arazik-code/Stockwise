using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class CodLedgerEntryConfiguration : IEntityTypeConfiguration<CodLedgerEntry>
{
    public void Configure(EntityTypeBuilder<CodLedgerEntry> builder)
    {
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Amount).HasPrecision(18, 2);
        builder.Property(e => e.Source).IsRequired().HasMaxLength(20);
        builder.Property(e => e.Note).HasMaxLength(500);

        builder.HasIndex(e => e.OnlineOrderId);
        builder.HasIndex(e => e.OzonParcelId);
        builder.HasIndex(e => e.CourierRemittanceId);
        builder.HasIndex(e => e.Type);

        builder.HasOne(e => e.OnlineOrder)
            .WithMany()
            .HasForeignKey(e => e.OnlineOrderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(e => e.OzonParcel)
            .WithMany()
            .HasForeignKey(e => e.OzonParcelId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(e => e.CourierRemittance)
            .WithMany(r => r.LedgerEntries)
            .HasForeignKey(e => e.CourierRemittanceId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
