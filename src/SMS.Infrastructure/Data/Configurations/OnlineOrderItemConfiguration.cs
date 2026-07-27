using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class OnlineOrderItemConfiguration : IEntityTypeConfiguration<OnlineOrderItem>
{
    public void Configure(EntityTypeBuilder<OnlineOrderItem> builder)
    {
        builder.HasKey(i => i.Id);

        builder.Property(i => i.ProductNameSnapshot).IsRequired().HasMaxLength(200);
        builder.Property(i => i.SkuSnapshot).IsRequired().HasMaxLength(50);
        builder.Property(i => i.ShopifySku).HasMaxLength(50);
        builder.Property(i => i.UnitPrice).HasPrecision(18, 2);
        builder.Property(i => i.DiscountAmount).HasPrecision(18, 2);
        builder.Property(i => i.LineTotal).HasPrecision(18, 2);

        builder.HasIndex(i => i.ShopifyVariantId);

        builder.HasOne(i => i.ProductVariant)
            .WithMany()
            .HasForeignKey(i => i.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
