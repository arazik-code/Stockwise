using SMS.Application.DTOs.Invoices;
using SMS.Application.Interfaces;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class InvoiceAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IInvoiceRepository> _invoiceRepoMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly InvoiceAppService _service;

    public InvoiceAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _invoiceRepoMock = new Mock<IInvoiceRepository>();
        _stockRepoMock = new Mock<IStockRepository>();
        _unitOfWorkMock.Setup(u => u.Invoices).Returns(_invoiceRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _service = new InvoiceAppService(_unitOfWorkMock.Object);
    }

    [Fact]
    public async Task CreateAsync_ValidRequest_CreatesInvoice()
    {
        var variant = new ProductVariant
        {
            Id = 1,
            Sku = "SHOE-001",
            Product = new Product { Id = 1, Name = "Nike Air", Price = 200m, CostPrice = 120m },
            Color = new Color { Name = "Black" },
            Size = new Size { Value = "42" }
        };

        _unitOfWorkMock.Setup(u => u.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProductVariant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ProductVariant> { variant });

        _invoiceRepoMock.Setup(r => r.GetMaxInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _invoiceRepoMock.Setup(r => r.AddAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()))
            .Callback<Invoice, CancellationToken>((i, _) => i.Id = 1)
            .ReturnsAsync((Invoice i, CancellationToken _) => i);

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Invoice
            {
                Id = 1,
                InvoiceNumber = "INV-000001",
                FournisseurId = 1,
                Fournisseur = new Fournisseur { Nom = "Nike" },
                Status = InvoiceStatus.Pending.ToString(),
                SubTotal = 1200m,
                TaxRate = 10,
                TaxAmount = 120m,
                TotalAmount = 1320m,
                PaymentTerms = "Net30",
                InvoiceDate = DateTime.UtcNow,
                DueDate = DateTime.UtcNow.AddDays(30),
                LineItems = new List<InvoiceLineItem>
                {
                    new() { Id = 1, ProductVariantId = 1, ProductName = "Nike Air", ProductSku = "SHOE-001", Quantity = 10, UnitCost = 120m, DiscountAmount = 0 }
                },
                Payments = new List<InvoicePayment>()
            });

        var request = new CreateInvoiceRequest
        {
            FournisseurId = 1,
            PaymentTerms = "Net30",
            TaxRate = 10,
            Items = [new CreateInvoiceLineItemRequest { ProductVariantId = 1, Quantity = 10, UnitCost = 120m }]
        };

        var result = await _service.CreateAsync(request, userId: 1);

        Assert.Equal("INV-000001", result.InvoiceNumber);
        Assert.Equal(InvoiceStatus.Pending, result.Status);
        Assert.Equal(1320m, result.TotalAmount);
    }

    [Fact]
    public async Task CreateAsync_EmptyItems_ThrowsArgumentException()
    {
        var request = new CreateInvoiceRequest
        {
            FournisseurId = 1,
            PaymentTerms = "Comptant",
            TaxRate = 10,
            Items = []
        };

        await Assert.ThrowsAsync<ArgumentException>(() => _service.CreateAsync(request));
    }

    [Fact]
    public async Task CreateAsync_ComptantPayment_NoDueDate()
    {
        var variant = new ProductVariant
        {
            Id = 1, Sku = "A001",
            Product = new Product { Name = "Shoe", Price = 100m, CostPrice = 60m },
            Color = new Color { Name = "Red" },
            Size = new Size { Value = "42" }
        };

        _unitOfWorkMock.Setup(u => u.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<ProductVariant, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ProductVariant> { variant });

        _invoiceRepoMock.Setup(r => r.GetMaxInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(0);

        _invoiceRepoMock.Setup(r => r.AddAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()))
            .Callback<Invoice, CancellationToken>((i, _) => i.Id = 1)
            .ReturnsAsync((Invoice i, CancellationToken _) => i);

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new Invoice
            {
                Id = 1, InvoiceNumber = "INV-000001", FournisseurId = 1,
                Fournisseur = new Fournisseur { Nom = "Test" },
                Status = InvoiceStatus.Pending.ToString(),
                SubTotal = 600m, TaxRate = 0, TaxAmount = 0, TotalAmount = 600m,
                PaymentTerms = "Comptant", InvoiceDate = DateTime.UtcNow,
                LineItems = new List<InvoiceLineItem>
                {
                    new() { ProductVariantId = 1, ProductName = "Shoe", Quantity = 10, UnitCost = 60m }
                },
                Payments = new List<InvoicePayment>()
            });

        var request = new CreateInvoiceRequest
        {
            FournisseurId = 1,
            PaymentTerms = "Comptant",
            TaxRate = 0,
            Items = [new CreateInvoiceLineItemRequest { ProductVariantId = 1, Quantity = 10, UnitCost = 60m }]
        };

        var result = await _service.CreateAsync(request);

        Assert.Null(result.DueDate);
    }

    [Fact]
    public async Task PayAsync_PartialPayment_SetsPartiallyPaid()
    {
        var invoice = new Invoice
        {
            Id = 1,
            InvoiceNumber = "INV-000001",
            FournisseurId = 1,
            Fournisseur = new Fournisseur { Nom = "Test" },
            Status = InvoiceStatus.Pending.ToString(),
            TotalAmount = 1000m,
            PaidAmount = 0,
            PaymentTerms = "Net30",
            InvoiceDate = DateTime.UtcNow,
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.PayAsync(1, new PayInvoiceRequest { Amount = 400m, PaymentMethod = "Cash" });

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.PartiallyPaid, result.Status);
        Assert.Equal(400m, result.PaidAmount);
    }

    [Fact]
    public async Task PayAsync_FullPayment_SetsPaid()
    {
        var invoice = new Invoice
        {
            Id = 1,
            InvoiceNumber = "INV-000001",
            FournisseurId = 1,
            Fournisseur = new Fournisseur { Nom = "Test" },
            Status = InvoiceStatus.Pending.ToString(),
            TotalAmount = 1000m,
            PaidAmount = 0,
            PaymentTerms = "Net30",
            InvoiceDate = DateTime.UtcNow,
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.PayAsync(1, new PayInvoiceRequest { Amount = 1000m, PaymentMethod = "Transfer" });

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Paid, result.Status);
        Assert.NotNull(result.PaidAt);
    }

    [Fact]
    public async Task PayAsync_AlreadyPaid_ThrowsInvalidOperation()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Paid.ToString(),
            TotalAmount = 1000m, PaidAmount = 1000m,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.PayAsync(1, new PayInvoiceRequest { Amount = 100m, PaymentMethod = "Cash" }));
    }

    [Fact]
    public async Task PayAsync_CancelledInvoice_ThrowsInvalidOperation()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Cancelled.ToString(),
            TotalAmount = 1000m, PaidAmount = 0,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.PayAsync(1, new PayInvoiceRequest { Amount = 100m, PaymentMethod = "Cash" }));
    }

    [Fact]
    public async Task CancelAsync_PendingInvoice_Cancels()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Pending.ToString(),
            TotalAmount = 1000m, PaidAmount = 0,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.CancelAsync(1, "No longer needed");

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Cancelled, result.Status);
        Assert.Contains("No longer needed", result.Notes!);
    }

    [Fact]
    public async Task CancelAsync_PaidInvoice_ThrowsInvalidOperation()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Paid.ToString(),
            TotalAmount = 1000m, PaidAmount = 1000m,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.CancelAsync(1));
    }

    [Fact]
    public async Task TogglePaidAsync_PendingInvoice_MarksFullyPaid()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Pending.ToString(),
            TotalAmount = 1000m, PaidAmount = 0,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.TogglePaidAsync(1);

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Paid, result.Status);
        Assert.Equal(1000m, result.PaidAmount);
        Assert.NotNull(result.PaidAt);
        Assert.Single(invoice.Payments);
        Assert.Equal(1000m, invoice.Payments.First().Amount);
    }

    [Fact]
    public async Task TogglePaidAsync_PartiallyPaidInvoice_RecordsOnlyRemainingBalance()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.PartiallyPaid.ToString(),
            TotalAmount = 1000m, PaidAmount = 400m,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment> { new() { Amount = 400m, PaymentMethod = "Cash" } }
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.TogglePaidAsync(1);

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Paid, result.Status);
        Assert.Equal(1000m, result.PaidAmount);
        Assert.Equal(2, invoice.Payments.Count);
        Assert.Equal(600m, invoice.Payments.Last().Amount);
    }

    [Fact]
    public async Task TogglePaidAsync_PaidInvoice_ReopensAsPending()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Paid.ToString(),
            TotalAmount = 1000m, PaidAmount = 1000m, PaidAt = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(10),
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment> { new() { Amount = 1000m, PaymentMethod = "Cash" } }
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.TogglePaidAsync(1);

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Pending, result.Status);
        Assert.Equal(0m, result.PaidAmount);
        Assert.Null(result.PaidAt);
        Assert.Empty(invoice.Payments);
    }

    [Fact]
    public async Task TogglePaidAsync_PaidInvoiceWithPastDueDate_ReopensAsOverdue()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Paid.ToString(),
            TotalAmount = 1000m, PaidAmount = 1000m, PaidAt = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(-5),
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment> { new() { Amount = 1000m, PaymentMethod = "Cash" } }
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        var result = await _service.TogglePaidAsync(1);

        Assert.NotNull(result);
        Assert.Equal(InvoiceStatus.Overdue, result.Status);
    }

    [Fact]
    public async Task TogglePaidAsync_CancelledInvoice_ThrowsInvalidOperation()
    {
        var invoice = new Invoice
        {
            Id = 1, Status = InvoiceStatus.Cancelled.ToString(),
            TotalAmount = 1000m, PaidAmount = 0,
            Fournisseur = new Fournisseur { Nom = "Test" },
            LineItems = new List<InvoiceLineItem>(),
            Payments = new List<InvoicePayment>()
        };

        _invoiceRepoMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.TogglePaidAsync(1));
    }

    [Fact]
    public async Task GetSummaryAsync_CalculatesCorrectly()
    {
        var rows = new List<InvoiceSummaryRow>
        {
            new(FournisseurId: 1, FournisseurNom: "A", Status: InvoiceStatus.Pending.ToString(), DueDate: DateTime.UtcNow.AddDays(10), Owed: 1000),
            new(FournisseurId: 2, FournisseurNom: "B", Status: InvoiceStatus.Paid.ToString(), DueDate: null, Owed: 0),
            new(FournisseurId: 1, FournisseurNom: "A", Status: InvoiceStatus.Pending.ToString(), DueDate: DateTime.UtcNow.AddDays(-5), Owed: 1500),
        };

        _invoiceRepoMock.Setup(r => r.GetSummaryRowsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(rows);

        var result = await _service.GetSummaryAsync();

        Assert.Equal(2500m, result.TotalOwed);
        Assert.Equal(1500m, result.TotalOverdue);
        Assert.Equal(2, result.PendingCount);
        Assert.Equal(1, result.PaidCount);
    }
}
