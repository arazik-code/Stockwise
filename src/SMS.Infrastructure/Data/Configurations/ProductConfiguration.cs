using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ProductConfiguration : IEntityTypeConfiguration<Product>
{
    public void Configure(EntityTypeBuilder<Product> builder)
    {
        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name).IsRequired().HasMaxLength(200);
        builder.Property(p => p.Description).HasMaxLength(2000);
        builder.Property(p => p.Brand).HasMaxLength(100);
        builder.Property(p => p.Barcode).HasMaxLength(100);
        builder.Property(p => p.ImageUrl).HasMaxLength(500);
        builder.Property(p => p.Price).HasPrecision(18, 2);
        builder.Property(p => p.CostPrice).HasPrecision(18, 2);
        builder.Property(p => p.LiquidationPrice).HasPrecision(18, 2);
        builder.Property(p => p.OnlinePrice).HasPrecision(18, 2);

        builder.HasIndex(p => p.Barcode).IsUnique();
        builder.HasIndex(p => p.ShopifyProductId);

        builder.HasOne(p => p.Category)
            .WithMany(c => c.Products)
            .HasForeignKey(p => p.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(p => p.Fournisseur)
            .WithMany(f => f.Products)
            .HasForeignKey(p => p.FournisseurId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
