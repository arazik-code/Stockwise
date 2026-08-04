using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).IsRequired().HasMaxLength(200);
        builder.Property(c => c.Phone).IsRequired().HasMaxLength(20);
        builder.Property(c => c.Email).HasMaxLength(200);
        builder.Property(c => c.QrCode).IsRequired().HasMaxLength(20);
        builder.Property(c => c.TotalSpent).HasPrecision(18, 2);
        builder.Property(c => c.LoyaltyRate).HasDefaultValue(5);
        builder.Property(c => c.Tags).HasMaxLength(500);
        builder.Property(c => c.City).HasMaxLength(120);
        builder.Property(c => c.AddressLine).HasMaxLength(400);
        builder.Property(c => c.ShopifyTotalSpent).HasPrecision(18, 2);

        builder.HasIndex(c => c.QrCode).IsUnique();
        builder.HasIndex(c => c.ShopifyCustomerId);
        builder.HasIndex(c => c.City);
        builder.HasIndex(c => c.EffectiveCategory);

        builder.HasMany(c => c.LoyaltyTransactions)
            .WithOne(lt => lt.Client)
            .HasForeignKey(lt => lt.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Sales)
            .WithOne(s => s.Client)
            .HasForeignKey(s => s.ClientId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
