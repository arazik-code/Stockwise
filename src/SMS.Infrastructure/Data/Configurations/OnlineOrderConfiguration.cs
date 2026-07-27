using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class OnlineOrderConfiguration : IEntityTypeConfiguration<OnlineOrder>
{
    public void Configure(EntityTypeBuilder<OnlineOrder> builder)
    {
        builder.HasKey(o => o.Id);

        builder.Property(o => o.OrderNumber).IsRequired().HasMaxLength(50);
        builder.Property(o => o.CustomerName).IsRequired().HasMaxLength(200);
        builder.Property(o => o.CustomerPhone).HasMaxLength(30);
        builder.Property(o => o.CustomerEmail).HasMaxLength(200);
        builder.Property(o => o.AddressLine).HasMaxLength(500);
        builder.Property(o => o.City).HasMaxLength(100);
        builder.Property(o => o.CarrierName).HasMaxLength(100);
        builder.Property(o => o.TrackingNumber).HasMaxLength(100);
        builder.Property(o => o.Notes).HasMaxLength(2000);

        builder.Property(o => o.SubTotal).HasPrecision(18, 2);
        builder.Property(o => o.DiscountAmount).HasPrecision(18, 2);
        builder.Property(o => o.ShippingFee).HasPrecision(18, 2);
        builder.Property(o => o.DeliveryFee).HasPrecision(18, 2);
        builder.Property(o => o.TotalAmount).HasPrecision(18, 2);
        builder.Property(o => o.AmountPaid).HasPrecision(18, 2);
        builder.Property(o => o.LoyaltyDiscountAmount).HasPrecision(18, 2);

        builder.HasIndex(o => o.OrderNumber).IsUnique();
        builder.HasIndex(o => o.Channel);
        builder.HasIndex(o => o.Status);
        builder.HasIndex(o => o.ClientId);
        builder.HasIndex(o => o.ShopifyOrderId);
        builder.HasIndex(o => o.SettlementStatus);

        builder.HasOne(o => o.Client)
            .WithMany(c => c.OnlineOrders)
            .HasForeignKey(o => o.ClientId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne(o => o.CreatedByUser)
            .WithMany()
            .HasForeignKey(o => o.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(o => o.Items)
            .WithOne(i => i.OnlineOrder)
            .HasForeignKey(i => i.OnlineOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
