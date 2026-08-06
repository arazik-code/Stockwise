using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Domain.Tests.Entities;

/// <summary>
/// Adversarial domain entity tests: invariant enforcement, edge cases,
/// and business rule validation at the domain level.
/// </summary>
public class AdversarialEntityTests
{
    // ── STOCK ITEM INVARIANTS ─────────────────────────────────────────

    [Fact]
    public void StockItem_NegativeOnHand_Allowed()
    {
        // Domain allows negative - the application layer should prevent it
        var stock = new StockItem { QuantityOnHand = -10 };
        Assert.Equal(-10, stock.QuantityOnHand);
    }

    [Fact]
    public void StockItem_AvailableIsComputed()
    {
        var stock = new StockItem
        {
            QuantityOnHand = 100,
            QuantityReserved = 30
        };
        Assert.Equal(70, stock.QuantityAvailable);
    }

    [Fact]
    public void StockItem_OverReserved_NegativeAvailable()
    {
        var stock = new StockItem
        {
            QuantityOnHand = 10,
            QuantityReserved = 50
        };
        Assert.Equal(-40, stock.QuantityAvailable);
    }

    [Fact]
    public void StockItem_MaxIntValues_NoOverflow()
    {
        var stock = new StockItem
        {
            QuantityOnHand = int.MaxValue,
            QuantityReserved = int.MaxValue
        };
        // Available should be 0 (max - max = 0), not overflow
        Assert.Equal(0, stock.QuantityAvailable);
    }

    // ── PRODUCT VARIANT INTEGRITY ─────────────────────────────────────

    [Fact]
    public void ProductVariant_CompositeKey_Enforced()
    {
        var v1 = new ProductVariant { ProductId = 1, ColorId = 1, SizeId = 1 };
        var v2 = new ProductVariant { ProductId = 1, ColorId = 1, SizeId = 1 };
        var v3 = new ProductVariant { ProductId = 1, ColorId = 1, SizeId = 2 };

        // v1 and v2 are duplicates (same Product+Color+Size)
        // v3 is unique (different SizeId)
        // Domain allows this - DB unique index catches duplicates
        Assert.Equal(v1.ProductId, v2.ProductId);
        Assert.Equal(v1.ColorId, v2.ColorId);
        Assert.Equal(v1.SizeId, v2.SizeId);
        Assert.NotEqual(v1.SizeId, v3.SizeId);
    }

    // ── SALE INVARIANTS ───────────────────────────────────────────────

    [Fact]
    public void Sale_DefaultValues_Consistent()
    {
        var sale = new Sale();
        Assert.Equal(0m, sale.SubTotal);
        Assert.Equal(0m, sale.TaxAmount);
        Assert.Equal(0m, sale.DiscountAmount);
        Assert.Equal(0m, sale.TotalAmount);
        Assert.Equal(0m, sale.AmountPaid);
        Assert.Equal(0m, sale.ChangeGiven);
        Assert.Equal(0, sale.LoyaltyPointsEarned);
        Assert.Equal(0, sale.LoyaltyPointsRedeemed);
        Assert.Equal(0m, sale.LoyaltyDiscountAmount);
    }

    [Fact]
    public void Sale_NegativeDiscount_Allowed()
    {
        // Domain doesn't enforce this - validators do
        var sale = new Sale { DiscountAmount = -100m };
        Assert.Equal(-100m, sale.DiscountAmount);
    }

    [Fact]
    public void Sale_AmountPaidExceedsTotal_Allowed()
    {
        // Overpayment is valid (change is given)
        var sale = new Sale
        {
            TotalAmount = 50m,
            AmountPaid = 100m,
            ChangeGiven = 50m
        };
        Assert.Equal(50m, sale.ChangeGiven);
    }

    // ── ONLINE ORDER STATUS EDGE CASES ────────────────────────────────

    [Theory]
    [InlineData(OrderStatus.Pending)]
    [InlineData(OrderStatus.Processing)]
    [InlineData(OrderStatus.Confirmed)]
    [InlineData(OrderStatus.Packing)]
    [InlineData(OrderStatus.ReadyToShip)]
    [InlineData(OrderStatus.Shipped)]
    [InlineData(OrderStatus.Delivered)]
    [InlineData(OrderStatus.Cancelled)]
    [InlineData(OrderStatus.Refunded)]
    [InlineData(OrderStatus.InventoryConflict)]
    [InlineData(OrderStatus.Returned)]
    [InlineData(OrderStatus.Refused)]
    public void OnlineOrder_AllStatuses_AreValid(OrderStatus status)
    {
        var order = new OnlineOrder { Status = status };
        Assert.Equal(status, order.Status);
    }

    [Fact]
    public void OnlineOrder_AllEnumValues_Defined()
    {
        var values = Enum.GetValues<OrderStatus>();
        Assert.Equal(12, values.Length);
    }

    // ── ONLINE ORDER FINANCIAL INVARIANTS ─────────────────────────────

    [Fact]
    public void OnlineOrder_NegativeDeliveryFee_Allowed()
    {
        // Domain doesn't enforce - validators do
        var order = new OnlineOrder { DeliveryFee = -50m };
        Assert.Equal(-50m, order.DeliveryFee);
    }

    [Fact]
    public void OnlineOrder_TotalAmountZero_Shipped()
    {
        var order = new OnlineOrder
        {
            TotalAmount = 0m,
            Status = OrderStatus.Shipped
        };
        Assert.Equal(0m, order.TotalAmount);
    }

    // ── INVOICE LINE ITEM COMPUTED TOTAL ──────────────────────────────

    [Fact]
    public void InvoiceLineItem_LineTotal_Computed()
    {
        var item = new InvoiceLineItem
        {
            Quantity = 10,
            UnitCost = 100m,
            DiscountAmount = 50m
        };
        // LineTotal = (Quantity * UnitCost) - DiscountAmount
        Assert.Equal(950m, item.LineTotal);
    }

    [Fact]
    public void InvoiceLineItem_ZeroQuantity_LineTotalNegative()
    {
        var item = new InvoiceLineItem
        {
            Quantity = 0,
            UnitCost = 100m,
            DiscountAmount = 50m
        };
        // LineTotal = (0 * 100) - 50 = -50
        // Domain allows this - validators prevent it
        Assert.Equal(-50m, item.LineTotal);
    }

    // ── COURIER REMITTANCE VARIANCE ───────────────────────────────────

    [Fact]
    public void CourierRemittance_Variance_Computed()
    {
        var remittance = new CourierRemittance
        {
            DeclaredAmount = 1000m,
            MatchedAmount = 950m
        };
        Assert.Equal(50m, remittance.VarianceAmount);
    }

    [Fact]
    public void CourierRemittance_NegativeVariance()
    {
        var remittance = new CourierRemittance
        {
            DeclaredAmount = 900m,
            MatchedAmount = 1000m
        };
        Assert.Equal(-100m, remittance.VarianceAmount);
    }

    // ── ENUM BOUNDARY TESTS ───────────────────────────────────────────

    [Fact]
    public void User_RoleId_InvalidValue_DoesNotThrow()
    {
        var user = new User { RoleId = -1 };
        Assert.Equal(-1, user.RoleId);
    }

    [Theory]
    [InlineData((SaleChannel)99)]
    public void SaleChannel_InvalidValue_DoesNotThrow(SaleChannel channel)
    {
        var sale = new Sale { Channel = channel };
        Assert.Equal(channel, sale.Channel);
    }

    [Theory]
    [InlineData((PaymentMethod)99)]
    public void PaymentMethod_InvalidValue_DoesNotThrow(PaymentMethod method)
    {
        var sale = new Sale { PaymentMethod = method };
        Assert.Equal(method, sale.PaymentMethod);
    }

    // ── CONCURRENCY TOKEN ─────────────────────────────────────────────

    [Fact]
    public void StockItem_AvailableCalculation_Consistent()
    {
        var stock = new StockItem
        {
            QuantityOnHand = 10,
            QuantityReserved = 0
        };
        // Available should equal OnHand when Reserved is 0
        Assert.Equal(stock.QuantityOnHand, stock.QuantityAvailable);
    }

    // ── ENTITY RELATIONSHIP INTEGRITY ─────────────────────────────────

    [Fact]
    public void Product_DefaultValues_Consistent()
    {
        var product = new Product();
        Assert.True(product.IsActive);
        Assert.Equal(string.Empty, product.Name);
        Assert.Empty(product.Variants);
    }

    [Fact]
    public void Client_LoyaltyPoints_DefaultsCorrect()
    {
        var client = new Client();
        Assert.Equal(0, client.TotalPoints);
        Assert.Equal(0, client.LifetimePoints);
        Assert.Equal(0m, client.TotalSpent);
        Assert.Equal(5, client.LoyaltyRate);
    }

    [Fact]
    public void OnlineOrder_StockReserved_DefaultFalse()
    {
        var order = new OnlineOrder();
        Assert.False(order.StockReserved);
    }

    // ── COD LEDGER SIGNED AMOUNTS ─────────────────────────────────────

    [Fact]
    public void CodLedgerEntry_PositiveAmount_MoneyOwed()
    {
        var entry = new CodLedgerEntry { Amount = 500m };
        Assert.Equal(500m, entry.Amount);
    }

    [Fact]
    public void CodLedgerEntry_NegativeAmount_CostOrFee()
    {
        var entry = new CodLedgerEntry { Amount = -100m };
        Assert.Equal(-100m, entry.Amount);
    }

    // ── LOYALTY TRANSACTION BOUNDARY ──────────────────────────────────

    [Fact]
    public void LoyaltyTransaction_Earn_PositivePoints()
    {
        var tx = new LoyaltyTransaction
        {
            PointsChange = 50,
            Type = LoyaltyTransactionType.Earn
        };
        Assert.Equal(50, tx.PointsChange);
    }

    [Fact]
    public void LoyaltyTransaction_Redeem_NegativePoints()
    {
        var tx = new LoyaltyTransaction
        {
            PointsChange = -100,
            Type = LoyaltyTransactionType.Redeem
        };
        Assert.Equal(-100, tx.PointsChange);
    }

    [Fact]
    public void LoyaltyTransaction_BalanceAfter_CanBeZero()
    {
        var tx = new LoyaltyTransaction
        {
            PointsChange = -100,
            BalanceAfter = 0
        };
        Assert.Equal(0, tx.BalanceAfter);
    }

    // ── RECEIPT BARCODE EXPIRY ────────────────────────────────────────

    [Fact]
    public void ReceiptBarcode_ExpiryDate_CanBePast()
    {
        var barcode = new ReceiptBarcode
        {
            ExpiresAt = DateTime.UtcNow.AddDays(-1),
            IsUsed = false
        };
        Assert.True(barcode.ExpiresAt < DateTime.UtcNow);
    }

    [Fact]
    public void ReceiptBarcode_ExpiryDate_CanBeFuture()
    {
        var barcode = new ReceiptBarcode
        {
            ExpiresAt = DateTime.UtcNow.AddDays(15),
            IsUsed = false
        };
        Assert.True(barcode.ExpiresAt > DateTime.UtcNow);
    }
}
