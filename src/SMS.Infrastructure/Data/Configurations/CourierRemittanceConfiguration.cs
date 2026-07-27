using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class CourierRemittanceConfiguration : IEntityTypeConfiguration<CourierRemittance>
{
    public void Configure(EntityTypeBuilder<CourierRemittance> builder)
    {
        builder.HasKey(r => r.Id);

        builder.Property(r => r.Carrier).IsRequired().HasMaxLength(50);
        builder.Property(r => r.Reference).HasMaxLength(100);
        builder.Property(r => r.BankRef).HasMaxLength(100);
        builder.Property(r => r.DeclaredAmount).HasPrecision(18, 2);
        builder.Property(r => r.MatchedAmount).HasPrecision(18, 2);
        builder.Ignore(r => r.VarianceAmount);

        builder.HasIndex(r => r.Status);
    }
}
