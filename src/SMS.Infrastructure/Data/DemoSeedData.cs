using Microsoft.EntityFrameworkCore;
using SMS.Domain.Entities;
using SMS.Domain.Enums;

namespace SMS.Infrastructure.Data;

/// <summary>
/// Creates a varied, realistic local demo catalog and activity without overwriting any store data.
/// Every item remains ordinary product/variant/stock data, so the normal screens and workflows apply.
/// </summary>
public static class DemoSeedData
{
    private sealed record DemoProduct(string Name, string Brand, string Category, decimal Cost, decimal Price, string[] Options, string[] Colors);

    private static readonly DemoProduct[] Catalog =
    [
        new("Everyday cotton T-shirt", "Northline", "Clothing", 55m, 129m, ["S", "M", "L", "XL"], ["Black", "White"]),
        new("Relaxed linen shirt", "Atelier 26", "Clothing", 145m, 329m, ["S", "M", "L"], ["Sand", "Blue"]),
        new("Essential denim jacket", "Northline", "Clothing", 260m, 549m, ["S", "M", "L", "XL"], ["Blue"]),
        new("Classic leather belt", "Forma", "Accessories", 70m, 179m, ["S", "M", "L"], ["Black", "Brown"]),
        new("Canvas everyday tote", "Forma", "Accessories", 48m, 119m, ["One size"], ["Natural", "Black"]),
        new("Signature Eau de Parfum 50 ml", "Maison Lumière", "Fragrance & Beauty", 185m, 399m, ["50 ml"], ["Standard"]),
        new("Signature Eau de Parfum 100 ml", "Maison Lumière", "Fragrance & Beauty", 285m, 599m, ["100 ml"], ["Standard"]),
        new("Nourishing hand cream", "Botanica", "Fragrance & Beauty", 32m, 79m, ["75 ml"], ["Standard"]),
        new("Matte ceramic mug", "Hearth & Home", "Home & Kitchen", 38m, 95m, ["350 ml"], ["Cream", "Green"]),
        new("Linen table runner", "Hearth & Home", "Home & Kitchen", 90m, 219m, ["140 cm"], ["Sand", "Olive"]),
        new("Insulated travel bottle", "Fieldwork", "Home & Kitchen", 82m, 189m, ["500 ml"], ["Black", "Sage"]),
        new("Wireless earbuds", "Soundwell", "Electronics", 220m, 449m, ["One size"], ["Black", "White"]),
        new("USB-C fast charger", "Soundwell", "Electronics", 78m, 169m, ["30 W"], ["White"]),
        new("Pocket notebook set", "Paperfolk", "Stationery", 28m, 69m, ["A5 · 3 pack"], ["Mixed"]),
        new("Everyday leather sneaker", "Forma", "Footwear", 240m, 499m, ["38", "39", "40", "41", "42", "43"], ["White", "Black"]),
        new("Reusable glass food container", "Hearth & Home", "Home & Kitchen", 42m, 99m, ["750 ml"], ["Clear"]),
    ];

    private static readonly (string Name, string? Parent)[] CategoryNames =
    [
        ("Clothing", null), ("Accessories", null), ("Fragrance & Beauty", null),
        ("Home & Kitchen", null), ("Electronics", null), ("Stationery", null), ("Footwear", null),
    ];

    public static async Task InitializeAsync(AppDbContext db, CancellationToken cancellationToken = default)
    {
        // A demo seed is strictly additive and only runs on a genuinely empty product catalog.
        if (await db.Products.AnyAsync(cancellationToken)) return;

        var admin = await db.Users.OrderBy(u => u.Id).FirstOrDefaultAsync(cancellationToken);
        if (admin is null) return;

        var now = DateTime.UtcNow;
        var categories = new Dictionary<string, Category>(StringComparer.OrdinalIgnoreCase);
        foreach (var (name, parentName) in CategoryNames)
        {
            var category = new Category { Name = name, Description = $"Demo catalog · {name}", CreatedAt = now, UpdatedAt = now };
            if (parentName is not null) category.ParentCategory = categories[parentName];
            categories.Add(name, category);
            db.Categories.Add(category);
        }

        var suppliers = new[]
        {
            new Fournisseur { Nom = "Atlas Goods Co.", Contact = "Demo account", Email = "hello@atlas-goods.example", Telephone = "+212 600 000 101", Adresse = "Casablanca, Morocco" },
            new Fournisseur { Nom = "Studio Supply", Contact = "Demo account", Email = "orders@studio-supply.example", Telephone = "+212 600 000 102", Adresse = "Rabat, Morocco" },
            new Fournisseur { Nom = "Everyday Wholesale", Contact = "Demo account", Email = "sales@everyday-wholesale.example", Telephone = "+212 600 000 103", Adresse = "Marrakech, Morocco" },
        };
        db.Fournisseurs.AddRange(suppliers);

        var colorNames = Catalog.SelectMany(p => p.Colors).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var colors = colorNames.ToDictionary(name => name, name => new Color { Name = name, HexCode = ColorHex(name), CreatedAt = now }, StringComparer.OrdinalIgnoreCase);
        db.Colors.AddRange(colors.Values);
        var optionNames = Catalog.SelectMany(p => p.Options).Distinct(StringComparer.OrdinalIgnoreCase).Order(StringComparer.OrdinalIgnoreCase).ToArray();
        var sizes = optionNames.ToDictionary(value => value, value => new Size { Value = value, CreatedAt = now }, StringComparer.OrdinalIgnoreCase);
        db.Sizes.AddRange(sizes.Values);

        var allVariants = new List<(ProductVariant Variant, int InitialStock, decimal Price)>();
        var supplierIndex = 0;
        var productIndex = 0;
        foreach (var item in Catalog)
        {
            var product = new Product
            {
                Name = item.Name, Brand = item.Brand,
                Description = $"Demo item for {item.Category.ToLowerInvariant()} · variants and live stock included.",
                Category = categories[item.Category], Fournisseur = suppliers[supplierIndex++ % suppliers.Length],
                CostPrice = item.Cost, Price = item.Price, OnlinePrice = item.Price * 1.05m,
                IsActive = true, CreatedAt = now.AddDays(-90 + productIndex), UpdatedAt = now,
            };
            var colorIndex = 0;
            foreach (var colorName in item.Colors)
            {
                var color = colors[colorName];
                var colorway = new ProductColorway { Product = product, Color = color, SortOrder = colorIndex++, CreatedAt = product.CreatedAt, UpdatedAt = now };
                product.Colorways.Add(colorway);
                foreach (var option in item.Options)
                {
                    var variant = new ProductVariant
                    {
                        Product = product, Color = color, Colorway = colorway, Size = sizes[option],
                        Sku = $"DEMO-{productIndex + 1:000}-{colorIndex:00}-{Array.IndexOf(item.Options, option) + 1:00}",
                        IsActive = true, CreatedAt = product.CreatedAt, UpdatedAt = now,
                    };
                    var stock = InitialStock(productIndex, colorIndex, option);
                    variant.StockItem = new StockItem { QuantityOnHand = stock, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 12, LastUpdatedAt = now };
                    product.Variants.Add(variant);
                    allVariants.Add((variant, stock, item.Price));
                }
            }
            db.Products.Add(product);
            productIndex++;
        }

        var clients = new[]
        {
            new Client { Name = "Amal Benali", Phone = "+212600000201", Email = "amal@example.test", QrCode = "DEMO-CLIENT-01", City = "Casablanca", Tags = "Returning, Demo", TotalPoints = 180, LifetimePoints = 260, LoyaltyRate = 8, CreatedAt = now.AddDays(-95) },
            new Client { Name = "Youssef Idrissi", Phone = "+212600000202", Email = "youssef@example.test", QrCode = "DEMO-CLIENT-02", City = "Rabat", Tags = "VIP, Demo", TotalPoints = 420, LifetimePoints = 620, LoyaltyRate = 12, CreatedAt = now.AddDays(-130) },
            new Client { Name = "Salma Alaoui", Phone = "+212600000203", Email = "salma@example.test", QrCode = "DEMO-CLIENT-03", City = "Marrakech", Tags = "New, Demo", TotalPoints = 45, LifetimePoints = 45, LoyaltyRate = 5, CreatedAt = now.AddDays(-12) },
            new Client { Name = "Omar Tazi", Phone = "+212600000204", Email = "omar@example.test", QrCode = "DEMO-CLIENT-04", City = "Tangier", Tags = "Returning, Demo", TotalPoints = 95, LifetimePoints = 155, LoyaltyRate = 8, CreatedAt = now.AddDays(-60) },
            new Client { Name = "Nadia Chraibi", Phone = "+212600000205", Email = "nadia@example.test", QrCode = "DEMO-CLIENT-05", City = "Agadir", Tags = "New, Demo", TotalPoints = 20, LifetimePoints = 20, LoyaltyRate = 5, CreatedAt = now.AddDays(-6) },
        };
        db.Clients.AddRange(clients);
        await db.SaveChangesAsync(cancellationToken);

        // Record opening balances so stock history has a useful audit trail from the first demo.
        foreach (var (variant, stock, _) in allVariants)
        {
            db.StockMovements.Add(new StockMovement
            {
                ProductVariantId = variant.Id, Type = StockMovementType.Initial,
                QuantityChange = stock, QuantityAfter = stock, Reference = "DEMO-OPENING",
                Notes = "Demo catalog opening balance", UserId = admin.Id, CreatedAt = now.AddDays(-30),
            });
        }

        // 40 dated transactions provide varied payment, customer, product and report history.
        for (var i = 0; i < 40; i++)
        {
            var variantIndex = (i * 7 + i / 3) % allVariants.Count;
            var (variant, _, price) = allVariants[variantIndex];
            var quantity = i % 9 == 0 ? 2 : 1;
            var subtotal = price * quantity;
            var discount = i % 7 == 0 ? decimal.Round(subtotal * 0.1m, 2) : 0m;
            var total = subtotal - discount;
            var client = i % 4 == 0 ? null : clients[i % clients.Length];
            var createdAt = now.AddDays(-28 + (i * 28 / 40)).AddHours(9 + i % 10).AddMinutes((i * 13) % 60);
            var sale = new Sale
            {
                SaleNumber = $"DEMO-{now:yyyyMMdd}-{i + 1:000}",
                Channel = i % 8 == 0 ? SaleChannel.Shopify : SaleChannel.Local,
                Category = i % 7 == 0 ? SaleCategory.VentePromotion : SaleCategory.VenteNormale,
                PaymentMethod = (PaymentMethod)(i % 3),
                SubTotal = subtotal, TaxAmount = 0, DiscountAmount = discount, TotalAmount = total,
                AmountPaid = total, ChangeGiven = 0, Status = OrderStatus.Delivered,
                Notes = "Generated sample transaction", UserId = i % 5 == 0 ? admin.Id : (db.Users.OrderBy(u => u.Id).Skip(1).Select(u => (int?)u.Id).FirstOrDefault() ?? admin.Id),
                Client = client, LoyaltyPointsEarned = client is null ? 0 : (int)(total / 10), CreatedAt = createdAt,
                Items = [new SaleItem { ProductVariantId = variant.Id, Quantity = quantity, UnitPrice = price, DiscountAmount = discount, LineTotal = total }],
            };
            db.Sales.Add(sale);
            var stockItem = variant.StockItem!;
            stockItem.QuantityOnHand = Math.Max(0, stockItem.QuantityOnHand - quantity);
            stockItem.LastUpdatedAt = now;
            db.StockMovements.Add(new StockMovement
            {
                ProductVariantId = variant.Id, Type = i % 8 == 0 ? StockMovementType.OnlineSale : StockMovementType.Sale,
                QuantityChange = -quantity, QuantityAfter = stockItem.QuantityOnHand,
                Reference = sale.SaleNumber, Notes = "Generated sample sale", UserId = sale.UserId, CreatedAt = createdAt,
            });
            if (client is not null)
            {
                client.TotalSpent += total;
                client.LastVisitAt = createdAt;
            }
        }

        await db.SaveChangesAsync(cancellationToken);
        Console.WriteLine($"[DemoSeed] Added {Catalog.Length} products, {allVariants.Count} variants, {clients.Length} clients, and 40 sample sales.");
    }

    private static int InitialStock(int productIndex, int colorIndex, string option)
    {
        // A few low-stock variants make the reorder and alert screens immediately demonstrable.
        if ((productIndex + colorIndex + option.Length) % 11 == 0) return 2;
        return 9 + (productIndex * 3 + colorIndex * 2 + option.Length) % 24;
    }

    private static string ColorHex(string name) => name.ToLowerInvariant() switch
    {
        "black" => "#202124", "white" => "#F7F7F5", "blue" => "#426A91", "sand" => "#D8C4A2",
        "brown" => "#795548", "natural" => "#D7C7A2", "cream" => "#F0E8D8", "green" => "#66836B",
        "olive" => "#797B4B", "sage" => "#A0AC99", "mixed" => "#9B89A8", "clear" => "#DCE5E8",
        _ => "#898989",
    };
}
