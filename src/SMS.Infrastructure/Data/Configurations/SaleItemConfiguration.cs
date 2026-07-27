using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class SaleItemConfiguration : IEntityTypeConfiguration<SaleItem>
{
    public void Configure(EntityTypeBuilder<SaleItem> builder)
    {
        builder.HasKey(si => si.Id);

        builder.Property(si => si.UnitPrice).HasPrecision(18, 2);
        builder.Property(si => si.DiscountAmount).HasPrecision(18, 2);
        builder.Property(si => si.LineTotal).HasPrecision(18, 2);

        builder.HasOne(si => si.Sale)
            .WithMany(s => s.Items)
            .HasForeignKey(si => si.SaleId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(si => si.ProductVariant)
            .WithMany()
            .HasForeignKey(si => si.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
