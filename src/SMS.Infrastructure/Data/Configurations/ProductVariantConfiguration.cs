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
        builder.HasIndex(v => v.ShopifyVariantId);

        builder.HasOne(v => v.Product)
            .WithMany(p => p.Variants)
            .HasForeignKey(v => v.ProductId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(v => v.Color)
            .WithMany(c => c.Variants)
            .HasForeignKey(v => v.ColorId)
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
