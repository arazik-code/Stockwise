using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class StockItemConfiguration : IEntityTypeConfiguration<StockItem>
{
    public void Configure(EntityTypeBuilder<StockItem> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property<uint>("xmin").IsRowVersion().HasColumnType("xid");

        builder.Property(s => s.QuantityOnHand).IsRequired();
        builder.Ignore(s => s.QuantityAvailable);

        builder.HasIndex(s => s.ProductVariantId).IsUnique();

        builder.HasOne(s => s.ProductVariant)
            .WithOne(v => v.StockItem)
            .HasForeignKey<StockItem>(s => s.ProductVariantId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
