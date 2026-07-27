using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ShopifyProductConfiguration : IEntityTypeConfiguration<ShopifyProduct>
{
    public void Configure(EntityTypeBuilder<ShopifyProduct> builder)
    {
        builder.HasKey(sp => sp.Id);

        builder.Property(sp => sp.Title).IsRequired().HasMaxLength(500);
        builder.Property(sp => sp.Sku).HasMaxLength(50);
        builder.Property(sp => sp.Price).HasPrecision(18, 2);

        builder.HasIndex(sp => sp.ShopifyProductId);
        builder.HasIndex(sp => new { sp.ShopifyProductId, sp.ShopifyVariantId }).IsUnique();

        builder.HasOne(sp => sp.LocalProduct)
            .WithMany()
            .HasForeignKey(sp => sp.LocalProductId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
