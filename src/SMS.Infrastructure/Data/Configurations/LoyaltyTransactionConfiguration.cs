using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class LoyaltyTransactionConfiguration : IEntityTypeConfiguration<LoyaltyTransaction>
{
    public void Configure(EntityTypeBuilder<LoyaltyTransaction> builder)
    {
        builder.HasKey(lt => lt.Id);

        builder.Property(lt => lt.Description).HasMaxLength(500);

        builder.HasOne(lt => lt.Client)
            .WithMany(c => c.LoyaltyTransactions)
            .HasForeignKey(lt => lt.ClientId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(lt => lt.Sale)
            .WithMany()
            .HasForeignKey(lt => lt.SaleId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
