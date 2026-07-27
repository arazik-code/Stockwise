using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class InvoiceLineItemConfiguration : IEntityTypeConfiguration<InvoiceLineItem>
{
    public void Configure(EntityTypeBuilder<InvoiceLineItem> builder)
    {
        builder.HasKey(li => li.Id);
        builder.Property(li => li.ProductName).IsRequired().HasMaxLength(200);
        builder.Property(li => li.ProductSku).HasMaxLength(50);
        builder.Property(li => li.Description).HasMaxLength(500);
        builder.Property(li => li.UnitCost).HasPrecision(18, 2);
        builder.Property(li => li.DiscountPercent).HasPrecision(5, 2);
        builder.Property(li => li.DiscountAmount).HasPrecision(18, 2);
        builder.HasOne(li => li.Invoice)
            .WithMany(i => i.LineItems)
            .HasForeignKey(li => li.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(li => li.ProductVariant)
            .WithMany()
            .HasForeignKey(li => li.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
