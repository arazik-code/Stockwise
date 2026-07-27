namespace SMS.Application.DTOs.Invoices;

public record InvoiceLabelDataDto(
    string ProductName,
    string Barcode,
    string ColorName,
    string SizeValue,
    decimal Price,
    int Quantity
);
