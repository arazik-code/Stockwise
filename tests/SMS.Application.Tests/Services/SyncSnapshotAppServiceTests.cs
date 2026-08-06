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
