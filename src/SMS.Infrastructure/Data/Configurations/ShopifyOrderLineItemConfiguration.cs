using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ShopifyOrderLineItemConfiguration : IEntityTypeConfiguration<ShopifyOrderLineItem>
{
    public void Configure(EntityTypeBuilder<ShopifyOrderLineItem> builder)
    {
        builder.HasKey(li => li.Id);

        builder.Property(li => li.Title).IsRequired().HasMaxLength(500);
        builder.Property(li => li.Price).HasPrecision(18, 2);

        builder.HasOne(li => li.ShopifyOrder)
            .WithMany(o => o.LineItems)
            .HasForeignKey(li => li.ShopifyOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(li => li.LocalProduct)
            .WithMany()
            .HasForeignKey(li => li.LocalProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
