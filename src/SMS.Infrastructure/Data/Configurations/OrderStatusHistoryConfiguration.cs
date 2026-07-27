using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class OrderStatusHistoryConfiguration : IEntityTypeConfiguration<OrderStatusHistory>
{
    public void Configure(EntityTypeBuilder<OrderStatusHistory> builder)
    {
        builder.HasKey(h => h.Id);

        builder.Property(h => h.Reason).HasMaxLength(500);

        builder.HasIndex(h => new { h.OnlineOrderId, h.CreatedAt });

        builder.HasOne(h => h.OnlineOrder)
            .WithMany()
            .HasForeignKey(h => h.OnlineOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
