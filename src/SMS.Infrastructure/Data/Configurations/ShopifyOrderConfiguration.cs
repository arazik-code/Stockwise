using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ShopifyOrderConfiguration : IEntityTypeConfiguration<ShopifyOrder>
{
    public void Configure(EntityTypeBuilder<ShopifyOrder> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.OrderNumber).IsRequired().HasMaxLength(50);
        builder.Property(o => o.FinancialStatus).IsRequired().HasMaxLength(50);
        builder.Property(o => o.FulfillmentStatus).IsRequired().HasMaxLength(50);
        builder.Property(o => o.TotalPrice).HasPrecision(18, 2);
        builder.Property(o => o.Currency).HasMaxLength(10);
        builder.Property(o => o.CustomerEmail).HasMaxLength(200);
        builder.Property(o => o.CustomerName).HasMaxLength(200);
        builder.Property(o => o.ShippingAddress).HasMaxLength(2000);

        builder.HasIndex(o => o.ShopifyOrderId).IsUnique();

        builder.HasMany(o => o.LineItems)
            .WithOne(li => li.ShopifyOrder)
            .HasForeignKey(li => li.ShopifyOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
