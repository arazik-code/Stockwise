using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.InvoiceNumber).IsRequired().HasMaxLength(50);
        builder.Property(i => i.SubTotal).HasPrecision(18, 2);
        builder.Property(i => i.DiscountAmount).HasPrecision(18, 2);
        builder.Property(i => i.TaxRate).HasPrecision(5, 2);
        builder.Property(i => i.TaxAmount).HasPrecision(18, 2);
        builder.Property(i => i.TotalAmount).HasPrecision(18, 2);
        builder.Property(i => i.PaidAmount).HasPrecision(18, 2);
        builder.Property(i => i.PaymentTerms).HasMaxLength(30);
        builder.Property(i => i.Notes).HasMaxLength(1000);
        builder.Property(i => i.Reference).HasMaxLength(100);
        builder.HasIndex(i => i.InvoiceNumber).IsUnique();
        builder.HasIndex(i => i.FournisseurId);
        builder.HasIndex(i => i.Status);
        builder.HasOne(i => i.Fournisseur)
            .WithMany()
            .HasForeignKey(i => i.FournisseurId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(i => i.CreatedByUser)
            .WithMany()
            .HasForeignKey(i => i.CreatedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
