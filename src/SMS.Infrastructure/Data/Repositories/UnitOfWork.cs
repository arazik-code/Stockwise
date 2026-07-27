using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SMS.Domain.Interfaces;

namespace SMS.Infrastructure.Data.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly AppDbContext _context;
    private IDbContextTransaction? _transaction;

    private IProductRepository? _products;
    private IStockRepository? _stock;
    private ISaleRepository? _sales;
    private IShopifyOrderRepository? _shopifyOrders;
    private IOnlineOrderRepository? _onlineOrders;
    private IClientRepository? _clients;
    private ILoyaltyTransactionRepository? _loyaltyTransactions;
    private IInvoiceRepository? _invoices;
    private IFournisseurRepository? _fournisseurs;
    private IColorRepository? _colors;
    private ISizeRepository? _sizes;

    public UnitOfWork(AppDbContext context)
    {
        _context = context;
    }

    public IProductRepository Products => _products ??= new ProductRepository(_context);
    public IStockRepository Stock => _stock ??= new StockRepository(_context);
    public ISaleRepository Sales => _sales ??= new SaleRepository(_context);
    public IShopifyOrderRepository ShopifyOrders => _shopifyOrders ??= new ShopifyOrderRepository(_context);
    public IOnlineOrderRepository OnlineOrders => _onlineOrders ??= new OnlineOrderRepository(_context);
    public IClientRepository Clients => _clients ??= new ClientRepository(_context);
    public ILoyaltyTransactionRepository LoyaltyTransactions => _loyaltyTransactions ??= new LoyaltyTransactionRepository(_context);
    public IInvoiceRepository Invoices => _invoices ??= new InvoiceRepository(_context);
    public IFournisseurRepository Fournisseurs => _fournisseurs ??= new FournisseurRepository(_context);
    public IColorRepository Colors => _colors ??= new ColorRepository(_context);
    public ISizeRepository Sizes => _sizes ??= new SizeRepository(_context);

    public IQueryable<T> Set<T>() where T : class
        => _context.Set<T>();

    public async Task AddAsync<T>(T entity, CancellationToken ct = default) where T : class
        => await _context.Set<T>().AddAsync(entity, ct);

    public void Remove<T>(T entity) where T : class
        => _context.Set<T>().Remove(entity);

    public void ClearChangeTracker()
        => _context.ChangeTracker.Clear();

    public async Task<IReadOnlyList<T>> FindAsync<T>(Expression<Func<T, bool>> predicate, CancellationToken ct = default) where T : class
        => await _context.Set<T>().Where(predicate).ToListAsync(ct);

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
        => await _context.SaveChangesAsync(ct);

    public async Task BeginTransactionAsync(CancellationToken ct = default)
        => _transaction = await _context.Database.BeginTransactionAsync(ct);

    public async Task CommitTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction is not null)
        {
            await _transaction.CommitAsync(ct);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public async Task RollbackTransactionAsync(CancellationToken ct = default)
    {
        if (_transaction is not null)
        {
            await _transaction.RollbackAsync(ct);
            await _transaction.DisposeAsync();
            _transaction = null;
        }
    }

    public void Dispose()
    {
        _transaction?.Dispose();
        _context.Dispose();
    }
}
