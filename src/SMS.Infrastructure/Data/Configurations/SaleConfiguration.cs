using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class SaleConfiguration : IEntityTypeConfiguration<Sale>
{
    public void Configure(EntityTypeBuilder<Sale> builder)
    {
        builder.HasKey(s => s.Id);

        builder.Property(s => s.SaleNumber).IsRequired().HasMaxLength(30);
        builder.Property(s => s.Category).IsRequired();
        builder.Property(s => s.Notes).HasMaxLength(500);
        builder.Property(s => s.SubTotal).HasPrecision(18, 2);
        builder.Property(s => s.TaxAmount).HasPrecision(18, 2);
        builder.Property(s => s.DiscountAmount).HasPrecision(18, 2);
        builder.Property(s => s.TotalAmount).HasPrecision(18, 2);
        builder.Property(s => s.AmountPaid).HasPrecision(18, 2);
        builder.Property(s => s.ChangeGiven).HasPrecision(18, 2);
        builder.Property(s => s.LoyaltyDiscountAmount).HasPrecision(18, 2);

        builder.HasIndex(s => s.SaleNumber).IsUnique();

        builder.HasOne(s => s.User)
            .WithMany()
            .HasForeignKey(s => s.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(s => s.Client)
            .WithMany(c => c.Sales)
            .HasForeignKey(s => s.ClientId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(s => s.Items)
            .WithOne(si => si.Sale)
            .HasForeignKey(si => si.SaleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
