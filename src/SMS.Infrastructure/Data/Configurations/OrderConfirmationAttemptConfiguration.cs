using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class OrderConfirmationAttemptConfiguration : IEntityTypeConfiguration<OrderConfirmationAttempt>
{
    public void Configure(EntityTypeBuilder<OrderConfirmationAttempt> builder)
    {
        builder.HasKey(a => a.Id);

        builder.Property(a => a.Note).HasMaxLength(500);

        builder.HasIndex(a => new { a.OnlineOrderId, a.CreatedAt });

        builder.HasOne(a => a.OnlineOrder)
            .WithMany()
            .HasForeignKey(a => a.OnlineOrderId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
