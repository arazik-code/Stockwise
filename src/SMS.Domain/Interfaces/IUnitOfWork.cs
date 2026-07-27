using System.Linq.Expressions;

namespace SMS.Domain.Interfaces;

public interface IUnitOfWork : IDisposable
{
    IProductRepository Products { get; }
    IStockRepository Stock { get; }
    ISaleRepository Sales { get; }
    IShopifyOrderRepository ShopifyOrders { get; }
    IOnlineOrderRepository OnlineOrders { get; }
    IClientRepository Clients { get; }
    ILoyaltyTransactionRepository LoyaltyTransactions { get; }
    IInvoiceRepository Invoices { get; }
    IFournisseurRepository Fournisseurs { get; }
    IColorRepository Colors { get; }
    ISizeRepository Sizes { get; }
    IQueryable<T> Set<T>() where T : class;
    Task AddAsync<T>(T entity, CancellationToken ct = default) where T : class;
    void Remove<T>(T entity) where T : class;
    void ClearChangeTracker();
    Task<int> SaveChangesAsync(CancellationToken ct = default);
    Task BeginTransactionAsync(CancellationToken ct = default);
    Task CommitTransactionAsync(CancellationToken ct = default);
    Task RollbackTransactionAsync(CancellationToken ct = default);
    Task<IReadOnlyList<T>> FindAsync<T>(Expression<Func<T, bool>> predicate, CancellationToken ct = default) where T : class;
}
