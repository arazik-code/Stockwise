using System.Linq.Expressions;
using SMS.Application.DTOs.Sync;
using SMS.Application.Services;
using SMS.Domain.Entities;
using SMS.Domain.Enums;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class SyncSnapshotAppServiceTests
{
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IStockRepository> _stockRepoMock;
    private readonly SyncSnapshotAppService _service;

    public SyncSnapshotAppServiceTests()
    {
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _stockRepoMock = new Mock<IStockRepository>();
        _unitOfWorkMock.Setup(u => u.Stock).Returns(_stockRepoMock.Object);
        _unitOfWorkMock.Setup(u => u.SaveChangesAsync(It.IsAny<CancellationToken>())).ReturnsAsync(1);

        // Default every entity type to "nothing exists locally yet" - individual tests override
        // just the type(s) relevant to what they're checking.
        SetupEmpty<Category>();
        SetupEmpty<Fournisseur>();
        SetupEmpty<Color>();
        SetupEmpty<Size>();
        SetupEmpty<Product>();
        SetupEmpty<ProductColorway>();
        SetupEmpty<ProductVariant>();
        SetupEmpty<StockItem>();
        SetupEmpty<Client>();
        SetupEmpty<User>();
        SetupEmpty<SyncState>();
        SetupEmpty<Role>();
        SetupEmpty<RoleSection>();

        SetupAddAsync<Category>();
        SetupAddAsync<Fournisseur>();
        SetupAddAsync<Color>();
        SetupAddAsync<Size>();
        SetupAddAsync<Product>();
        SetupAddAsync<ProductColorway>();
        SetupAddAsync<ProductVariant>();
        SetupAddAsync<StockItem>();
        SetupAddAsync<Client>();
        SetupAddAsync<User>();
        SetupAddAsync<SyncState>();
        SetupAddAsync<Role>();
        SetupAddAsync<RoleSection>();

        _stockRepoMock.Setup(r => r.GetMovementsAsync(It.IsAny<int?>(), It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockMovement>());

        _service = new SyncSnapshotAppService(_unitOfWorkMock.Object);
    }

    private void SetupEmpty<T>() where T : class
        => _unitOfWorkMock
            .Setup(u => u.FindAsync(It.IsAny<Expression<Func<T, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<T>());

    private void SetupAddAsync<T>() where T : class
        => _unitOfWorkMock
            .Setup(u => u.AddAsync(It.IsAny<T>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

    private void Setup<T>(List<T> items) where T : class
        => _unitOfWorkMock
            .Setup(u => u.FindAsync(It.IsAny<Expression<Func<T, bool>>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(items);

    // ── Colourway tier: the terminal and the VPS run the same binary but are deployed separately,
    // so a snapshot can arrive from either an older or a newer build than the receiver. ─────────

    [Fact]
    public async Task ApplySnapshotAsync_SnapshotWithColorways_UpsertsThemBeforeVariants()
    {
        var snapshot = new SyncSnapshotDto
        {
            ProductColorways = [new SyncProductColorwayDto { Id = 7, ProductId = 1, ColorId = 2, ShopifyProductId = 555, IsActive = true }],
            ProductVariants = [new SyncProductVariantDto { Id = 1, ProductId = 1, ColorwayId = 7, ColorId = 2, SizeId = 3, Sku = "A-1" }]
        };

        ProductVariant? added = null;
        _unitOfWorkMock.Setup(u => u.AddAsync(It.IsAny<ProductVariant>(), It.IsAny<CancellationToken>()))
            .Callback<ProductVariant, CancellationToken>((v, _) => added = v)
            .Returns(Task.CompletedTask);

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(1, result.ProductColorwaysUpserted);
        Assert.Equal(1, result.ProductVariantsUpserted);
        Assert.Equal(7, added!.ColorwayId);
    }

    [Fact]
    public async Task ApplySnapshotAsync_SnapshotFromPreColorwayBuild_RebuildsColorwaysFromVariants()
    {
        // An older sender: no ProductColorways array at all, and ColorwayId left at its 0 default.
        // The receiver must reconstruct the colourways rather than reject the snapshot, and must
        // let the database assign their Ids so it cannot collide with colourways it already holds.
        var snapshot = new SyncSnapshotDto
        {
            ProductVariants =
            [
                new SyncProductVariantDto { Id = 1, ProductId = 1, ColorId = 2, SizeId = 3, Sku = "A-1" },
                new SyncProductVariantDto { Id = 2, ProductId = 1, ColorId = 2, SizeId = 4, Sku = "A-2" },
                new SyncProductVariantDto { Id = 3, ProductId = 1, ColorId = 9, SizeId = 3, Sku = "B-1" }
            ]
        };

        var addedColorways = new List<ProductColorway>();
        _unitOfWorkMock.Setup(u => u.AddAsync(It.IsAny<ProductColorway>(), It.IsAny<CancellationToken>()))
            .Callback<ProductColorway, CancellationToken>((c, _) => addedColorways.Add(c))
            .Returns(Task.CompletedTask);

        var result = await _service.ApplySnapshotAsync(snapshot);

        // Two distinct (product, colour) pairs across three variants.
        Assert.Equal(2, result.ProductColorwaysUpserted);
        Assert.Equal(3, result.ProductVariantsUpserted);
        Assert.Equal([(1, 2), (1, 9)], addedColorways.Select(c => (c.ProductId, c.ColorId)));
        Assert.All(addedColorways, c => Assert.Equal(0, c.Id)); // database-assigned, not invented
    }

    [Fact]
    public async Task ApplySnapshotAsync_PreColorwayVariantMatchingAnExistingColorway_ReusesIt()
    {
        // Same older sender, but this receiver already has the colourway. Nothing new is created
        // and the variant is pointed at the row that is already there.
        Setup(new List<ProductColorway> { new() { Id = 42, ProductId = 1, ColorId = 2 } });

        var snapshot = new SyncSnapshotDto
        {
            ProductVariants = [new SyncProductVariantDto { Id = 1, ProductId = 1, ColorId = 2, SizeId = 3, Sku = "A-1" }]
        };

        ProductVariant? added = null;
        _unitOfWorkMock.Setup(u => u.AddAsync(It.IsAny<ProductVariant>(), It.IsAny<CancellationToken>()))
            .Callback<ProductVariant, CancellationToken>((v, _) => added = v)
            .Returns(Task.CompletedTask);

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(0, result.ProductColorwaysUpserted);
        Assert.Equal(42, added!.ColorwayId);
    }

    [Fact]
    public async Task BuildSnapshotAsync_IncludesColorwaysAndStampsThemOnVariants()
    {
        Setup(new List<ProductColorway> { new() { Id = 7, ProductId = 1, ColorId = 2, ShopifyProductId = 555, ShopifyTitle = "Derby Noir" } });
        Setup(new List<ProductVariant> { new() { Id = 1, ProductId = 1, ColorwayId = 7, ColorId = 2, SizeId = 3, Sku = "A-1" } });

        var snapshot = await _service.BuildSnapshotAsync();

        var colorway = Assert.Single(snapshot.ProductColorways);
        Assert.Equal(555, colorway.ShopifyProductId);
        Assert.Equal("Derby Noir", colorway.ShopifyTitle);
        Assert.Equal(7, Assert.Single(snapshot.ProductVariants).ColorwayId);
    }

    [Fact]
    public async Task ApplySnapshotAsync_NewStockItem_NoPriorSync_IsUpserted()
    {
        Setup(new List<StockItem>()); // nothing local yet
        _stockRepoMock.Setup(r => r.GetMovementsAsync(null, It.IsAny<DateTime>(), null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockMovement>());

        var snapshot = new SyncSnapshotDto
        {
            StockItems = [new SyncStockItemDto { ProductVariantId = 1, QuantityOnHand = 10, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20, LastUpdatedAt = DateTime.UtcNow }]
        };

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(1, result.StockItemsUpserted);
        Assert.Equal(0, result.StockItemsSkippedDueToLocalActivity);
    }

    [Fact]
    public async Task ApplySnapshotAsync_StockUntouchedSinceLastSync_IsOverwritten()
    {
        var lastSync = DateTime.UtcNow.AddHours(-6);
        Setup(new List<SyncState> { new() { Id = 1, LastSyncedAt = lastSync } });

        var localStockItem = new StockItem { ProductVariantId = 1, QuantityOnHand = 3, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20 };
        Setup(new List<StockItem> { localStockItem });

        // No movements for this variant since the last sync - safe to overwrite.
        _stockRepoMock.Setup(r => r.GetMovementsAsync(null, lastSync, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockMovement>());

        var snapshot = new SyncSnapshotDto
        {
            StockItems = [new SyncStockItemDto { ProductVariantId = 1, QuantityOnHand = 25, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20, LastUpdatedAt = DateTime.UtcNow }]
        };

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(1, result.StockItemsUpserted);
        Assert.Equal(0, result.StockItemsSkippedDueToLocalActivity);
        Assert.Equal(25, localStockItem.QuantityOnHand);
    }

    [Fact]
    public async Task ApplySnapshotAsync_StockTouchedLocallySinceLastSync_IsSkipped()
    {
        var lastSync = DateTime.UtcNow.AddHours(-6);
        Setup(new List<SyncState> { new() { Id = 1, LastSyncedAt = lastSync } });

        // Local fallback sale decremented this variant's stock after the last sync.
        var localStockItem = new StockItem { ProductVariantId = 1, QuantityOnHand = 2, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20 };
        Setup(new List<StockItem> { localStockItem });

        var movementAfterSync = new StockMovement { ProductVariantId = 1, Type = StockMovementType.Sale, QuantityChange = -1, QuantityAfter = 2, CreatedAt = DateTime.UtcNow.AddHours(-1) };
        _stockRepoMock.Setup(r => r.GetMovementsAsync(null, lastSync, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<StockMovement> { movementAfterSync });

        var snapshot = new SyncSnapshotDto
        {
            // VPS's snapshot still shows the pre-sale quantity, since it doesn't know about the
            // sale that happened locally while disconnected.
            StockItems = [new SyncStockItemDto { ProductVariantId = 1, QuantityOnHand = 3, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20, LastUpdatedAt = DateTime.UtcNow.AddHours(-6) }]
        };

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(0, result.StockItemsUpserted);
        Assert.Equal(1, result.StockItemsSkippedDueToLocalActivity);
        // The local, correct-post-sale quantity must survive untouched.
        Assert.Equal(2, localStockItem.QuantityOnHand);
    }

    [Fact]
    public async Task ApplySnapshotAsync_ClientVisitedLocallySinceLastSync_LoyaltyFieldsSkippedButContactFieldsSync()
    {
        var lastSync = DateTime.UtcNow.AddHours(-6);
        Setup(new List<SyncState> { new() { Id = 1, LastSyncedAt = lastSync } });

        var localClient = new Client
        {
            Id = 1,
            Name = "Old Name",
            Phone = "0600000000",
            TotalPoints = 50,
            TotalSpent = 500m,
            LastVisitAt = DateTime.UtcNow.AddHours(-1) // visited locally after the last sync
        };
        Setup(new List<Client> { localClient });

        var snapshot = new SyncSnapshotDto
        {
            Clients =
            [
                new SyncClientDto
                {
                    Id = 1,
                    Name = "New Name From VPS",
                    Phone = "0600000000",
                    TotalPoints = 10, // stale - VPS doesn't know about the local sale that earned points
                    TotalSpent = 100m,
                    CreatedAt = DateTime.UtcNow
                }
            ]
        };

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(1, result.ClientsUpserted);
        Assert.Equal(1, result.ClientsSkippedLoyaltyFieldsDueToLocalActivity);
        Assert.Equal("New Name From VPS", localClient.Name); // contact info always syncs
        Assert.Equal(50, localClient.TotalPoints); // loyalty fields protected
        Assert.Equal(500m, localClient.TotalSpent);
    }

    [Fact]
    public async Task ApplySnapshotAsync_ClientNotVisitedSinceLastSync_AllFieldsOverwritten()
    {
        var lastSync = DateTime.UtcNow.AddHours(-6);
        Setup(new List<SyncState> { new() { Id = 1, LastSyncedAt = lastSync } });

        var localClient = new Client
        {
            Id = 1,
            Name = "Old Name",
            TotalPoints = 10,
            LastVisitAt = DateTime.UtcNow.AddDays(-10) // last visited well before the last sync
        };
        Setup(new List<Client> { localClient });

        var snapshot = new SyncSnapshotDto
        {
            Clients = [new SyncClientDto { Id = 1, Name = "Fresh From VPS", TotalPoints = 99, CreatedAt = DateTime.UtcNow }]
        };

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(0, result.ClientsSkippedLoyaltyFieldsDueToLocalActivity);
        Assert.Equal(99, localClient.TotalPoints);
    }

    [Fact]
    public async Task ApplySnapshotAsync_FirstEverSync_NoLastSyncedAt_StockAlwaysOverwritten()
    {
        // SyncState row doesn't exist yet - first sync ever. Nothing to compare "since" against,
        // so trust the snapshot rather than skip everything.
        var localStockItem = new StockItem { ProductVariantId = 1, QuantityOnHand = 0, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20 };
        Setup(new List<StockItem> { localStockItem });

        var snapshot = new SyncSnapshotDto
        {
            StockItems = [new SyncStockItemDto { ProductVariantId = 1, QuantityOnHand = 40, QuantityReserved = 0, ReorderLevel = 5, ReorderQuantity = 20, LastUpdatedAt = DateTime.UtcNow }]
        };

        var result = await _service.ApplySnapshotAsync(snapshot);

        Assert.Equal(1, result.StockItemsUpserted);
        Assert.Equal(0, result.StockItemsSkippedDueToLocalActivity);
        Assert.Equal(40, localStockItem.QuantityOnHand);
        _stockRepoMock.Verify(r => r.GetMovementsAsync(It.IsAny<int?>(), It.IsAny<DateTime>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ApplySnapshotAsync_UpdatesSyncStateLastSyncedAt()
    {
        SyncState? captured = null;
        _unitOfWorkMock
            .Setup(u => u.AddAsync(It.IsAny<SyncState>(), It.IsAny<CancellationToken>()))
            .Callback<SyncState, CancellationToken>((s, _) => captured = s)
            .Returns(Task.CompletedTask);

        await _service.ApplySnapshotAsync(new SyncSnapshotDto());

        Assert.NotNull(captured);
        Assert.NotNull(captured!.LastSyncedAt);
    }
}
