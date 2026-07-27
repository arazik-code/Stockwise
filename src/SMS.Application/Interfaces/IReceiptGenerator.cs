namespace SMS.Application.Interfaces;

public interface IReceiptGenerator
{
    string GenerateReceiptHtml(DTOs.Sales.SaleDto sale);
}
