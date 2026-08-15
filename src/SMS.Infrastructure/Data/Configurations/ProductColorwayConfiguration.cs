using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ProductColorwayConfiguration : IEntityTypeConfiguration<ProductColorway>
{
    public void Configure(EntityTypeBuilder<ProductColorway> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.ImageUrl).HasMaxLength(500);
        builder.Property(c => c.ShopifyTitle).HasMaxLength(300);
        builder.Property(c => c.OnlinePrice).HasPrecision(18, 2);

        // A product has each colour at most once - the colourway IS the (product, colour) pair.
        builder.HasIndex(c => new { c.ProductId, c.ColorId }).IsUnique();

        // The alternate key that ProductVariant's composite FK points at. It is what makes the
        // ProductId/ColorId columns duplicated on ProductVariant impossible to drift out of sync
        // with this row - Postgres rejects the write rather than trusting application code.
        builder.HasAlternateKey(c => new { c.Id, c.ProductId, c.ColorId });

        // Unique, but only over colourways that actually carry a link - a partial index, matching
        // the treatment of ProductVariant.ShopifyVariantId. Two colourways pointing at the same
        // Shopify product would have them overwrite each other's stock on the storefront.
        builder.HasIndex(c => c.ShopifyProductId)
            .IsUnique()
            .HasFilter("\"ShopifyProductId\" IS NOT NULL");

        builder.HasOne(c => c.Product)
            .WithMany(p => p.Colorways)
            .HasForeignKey(c => c.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(c => c.Color)
            .WithMany(col => col.Colorways)
            .HasForeignKey(c => c.ColorId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
