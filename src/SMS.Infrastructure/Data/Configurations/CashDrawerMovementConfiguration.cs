using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class CashDrawerMovementConfiguration : IEntityTypeConfiguration<CashDrawerMovement>
{
    public void Configure(EntityTypeBuilder<CashDrawerMovement> builder)
    {
        builder.HasKey(m => m.Id);

        builder.Property(m => m.Amount).HasPrecision(18, 2);
        builder.Property(m => m.Reason).HasMaxLength(300);

        builder.HasOne(m => m.User)
            .WithMany()
            .HasForeignKey(m => m.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(m => m.CreatedAt);
    }
}
