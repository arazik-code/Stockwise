using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class FournisseurConfiguration : IEntityTypeConfiguration<Fournisseur>
{
    public void Configure(EntityTypeBuilder<Fournisseur> builder)
    {
        builder.HasKey(f => f.Id);
        builder.Property(f => f.Nom).IsRequired().HasMaxLength(100);
        builder.Property(f => f.Contact).HasMaxLength(200);
        builder.Property(f => f.Email).HasMaxLength(200);
        builder.Property(f => f.Telephone).HasMaxLength(50);
        builder.Property(f => f.Adresse).HasMaxLength(500);
    }
}
