using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ProductVariantConfiguration : IEntityTypeConfiguration<ProductVariant>
{
    public void Configure(EntityTypeBuilder<ProductVariant> builder)
    {
        builder.HasKey(v => v.Id);

        builder.Property(v => v.Sku).IsRequired().HasMaxLength(50);
        builder.Property(v => v.Barcode).HasMaxLength(100);
        builder.Property(v => v.ImageUrl).HasMaxLength(500);

        builder.HasIndex(v => v.Sku).IsUnique();
        builder.HasIndex(v => v.Barcode);
        builder.HasIndex(v => new { v.ProductId, v.ColorId, v.SizeId }).IsUnique();
        builder.HasIndex(v => new { v.ColorwayId, v.SizeId }).IsUnique();
        // Unique, but only over rows that actually carry a link - a partial index so the ~19 local-only
        // variants (all NULL) don't collide with each other. Two local variants pointing at the same
        // Shopify variant would have them overwrite each other's stock on the storefront at random.
        builder.HasIndex(v => v.ShopifyVariantId)
            .IsUnique()
            .HasFilter("\"ShopifyVariantId\" IS NOT NULL");

        builder.HasOne(v => v.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Color)
            .WithMany(c => c.Variants)
            .HasForeignKey(v => v.ColorId)
            .OnDelete(DeleteBehavior.Restrict);

        // Composite FK, not a plain one on ColorwayId. ProductVariant carries its own ProductId
        // and ColorId so that the ~30 existing `variant.Product` includes and GroupBy(ProductId)
        // aggregations keep working untouched; routing all three columns through the colourway's
        // alternate key is what stops that duplication from ever drifting. Restrict rather than
        // Cascade: deleting a colourway out from under live variants should fail loudly, and the
        // Product -> ProductVariant cascade already handles deleting a whole product.
        builder.HasOne(v => v.Colorway)
            .WithMany(c => c.Variants)
            .HasForeignKey(v => new { v.ColorwayId, v.ProductId, v.ColorId })
            .HasPrincipalKey(c => new { c.Id, c.ProductId, c.ColorId })
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(v => v.Size)
            .WithMany(s => s.Variants)
            .HasForeignKey(v => v.SizeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(v => v.StockItem)
            .WithOne(si => si.ProductVariant)
            .HasForeignKey<StockItem>(si => si.ProductVariantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
