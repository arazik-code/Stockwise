using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class StockMovementConfiguration : IEntityTypeConfiguration<StockMovement>
{
    public void Configure(EntityTypeBuilder<StockMovement> builder)
    {
        builder.HasKey(sm => sm.Id);

        builder.HasOne(sm => sm.ProductVariant)
            .WithMany()
            .HasForeignKey(sm => sm.ProductVariantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(sm => sm.User)
            .WithMany()
            .HasForeignKey(sm => sm.UserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
