using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class ReceiptBarcodeConfiguration : IEntityTypeConfiguration<ReceiptBarcode>
{
    public void Configure(EntityTypeBuilder<ReceiptBarcode> builder)
    {
        builder.HasKey(rb => rb.Id);

        builder.Property(rb => rb.Barcode).IsRequired().HasMaxLength(50);

        builder.HasIndex(rb => rb.Barcode).IsUnique();

        builder.HasOne(rb => rb.Sale)
            .WithMany(s => s.ReceiptBarcodes)
            .HasForeignKey(rb => rb.SaleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
