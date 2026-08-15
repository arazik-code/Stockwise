using SMS.Application.DTOs.Sync;
using SMS.Application.Interfaces;
using SMS.Domain.Entities;
using SMS.Domain.Interfaces;

namespace SMS.Application.Services;

// Nightly VPS -> local-fallback sync (see plan doc Phase 4). BuildSnapshotAsync runs on whichever
// instance holds the authoritative data (the VPS); ApplySnapshotAsync runs on the receiving side
// (the local fallback). Both live in the same service because both instances run the exact same
// codebase - which one is "VPS" vs "local" is purely a config/role distinction, not a code split.
public class SyncSnapshotAppService : ISyncSnapshotService
{
    private readonly IUnitOfWork _unitOfWork;

    public SyncSnapshotAppService(IUnitOfWork unitOfWork)
    {
        _unitOfWork = unitOfWork;
    }

    public async Task<SyncSnapshotDto> BuildSnapshotAsync(CancellationToken ct = default)
    {
        var categories = await _unitOfWork.FindAsync<Category>(_ => true, ct);
        var fournisseurs = await _unitOfWork.FindAsync<Fournisseur>(_ => true, ct);
        var products = await _unitOfWork.FindAsync<Product>(_ => true, ct);
        var colors = await _unitOfWork.FindAsync<Color>(_ => true, ct);
        var sizes = await _unitOfWork.FindAsync<Size>(_ => true, ct);
        var colorways = await _unitOfWork.FindAsync<ProductColorway>(_ => true, ct);
        var variants = await _unitOfWork.FindAsync<ProductVariant>(_ => true, ct);
        var stockItems = await _unitOfWork.FindAsync<StockItem>(_ => true, ct);
        var clients = await _unitOfWork.FindAsync<Client>(_ => true, ct);
        var users = await _unitOfWork.FindAsync<User>(_ => true, ct);
        var roles = await _unitOfWork.FindAsync<Role>(_ => true, ct);
        var roleSections = await _unitOfWork.FindAsync<RoleSection>(_ => true, ct);
        var sectionsByRoleId = roleSections.GroupBy(rs => rs.RoleId).ToDictionary(g => g.Key, g => g.Select(rs => rs.SectionKey).ToList());
        var roleNameById = roles.ToDictionary(r => r.Id, r => r.Name);

        return new SyncSnapshotDto
        {
            GeneratedAt = DateTime.UtcNow,
            Categories = categories.Select(c => new SyncCategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                ParentCategoryId = c.ParentCategoryId
            }).ToList(),
            Fournisseurs = fournisseurs.Select(f => new SyncFournisseurDto
            {
                Id = f.Id,
                Nom = f.Nom,
                Contact = f.Contact,
                Email = f.Email,
                Telephone = f.Telephone,
                Adresse = f.Adresse
            }).ToList(),
            Products = products.Select(p => new SyncProductDto
            {
                Id = p.Id,
                Name = p.Name,
                Description = p.Description,
                Brand = p.Brand,
                Barcode = p.Barcode,
                ImageUrl = p.ImageUrl,
                Price = p.Price,
                CostPrice = p.CostPrice,
                LiquidationPrice = p.LiquidationPrice,
                OnlinePrice = p.OnlinePrice,
                CategoryId = p.CategoryId,
                FournisseurId = p.FournisseurId,
                IsActive = p.IsActive
            }).ToList(),
            ProductColorways = colorways.Select(c => new SyncProductColorwayDto
            {
                Id = c.Id,
                ProductId = c.ProductId,
                ColorId = c.ColorId,
                ImageUrl = c.ImageUrl,
                OnlinePrice = c.OnlinePrice,
                ShopifyProductId = c.ShopifyProductId,
                ShopifyTitle = c.ShopifyTitle,
                SortOrder = c.SortOrder,
                IsActive = c.IsActive
            }).ToList(),
            Colors = colors.Select(c => new SyncColorDto
            {
                Id = c.Id,
                Name = c.Name,
                HexCode = c.HexCode,
                SortOrder = c.SortOrder
            }).ToList(),
            Sizes = sizes.Select(s => new SyncSizeDto
            {
                Id = s.Id,
                Value = s.Value,
                SortOrder = s.SortOrder
            }).ToList(),
            ProductVariants = variants.Select(v => new SyncProductVariantDto
            {
                Id = v.Id,
                ProductId = v.ProductId,
                ColorwayId = v.ColorwayId,
                ColorId = v.ColorId,
                SizeId = v.SizeId,
                Sku = v.Sku,
                Barcode = v.Barcode,
                ImageUrl = v.ImageUrl,
                IsActive = v.IsActive,
                IsLiquidation = v.IsLiquidation,
                ShopifyVariantId = v.ShopifyVariantId
            }).ToList(),
            StockItems = stockItems.Select(s => new SyncStockItemDto
            {
                ProductVariantId = s.ProductVariantId,
                QuantityOnHand = s.QuantityOnHand,
                QuantityReserved = s.QuantityReserved,
                ReorderLevel = s.ReorderLevel,
                ReorderQuantity = s.ReorderQuantity,
                LastUpdatedAt = s.LastUpdatedAt
            }).ToList(),
            Clients = clients.Select(c => new SyncClientDto
            {
                Id = c.Id,
                Name = c.Name,
                Phone = c.Phone,
                Email = c.Email,
                QrCode = c.QrCode,
                TotalPoints = c.TotalPoints,
                LifetimePoints = c.LifetimePoints,
                TotalSpent = c.TotalSpent,
                LoyaltyRate = c.LoyaltyRate,
                CreatedAt = c.CreatedAt,
                LastVisitAt = c.LastVisitAt,
                ShopifyCustomerId = c.ShopifyCustomerId,
                Tags = c.Tags,
                City = c.City,
                AddressLine = c.AddressLine,
                ShopifyTotalSpent = c.ShopifyTotalSpent,
                ShopifyOrdersCount = c.ShopifyOrdersCount,
                ManualCategory = c.ManualCategory,
                ComputedCategory = c.ComputedCategory,
                EffectiveCategory = c.EffectiveCategory,
                CategoryUpdatedAt = c.CategoryUpdatedAt
            }).ToList(),
            Roles = roles.Select(r => new SyncRoleDto
            {
                Name = r.Name,
                Description = r.Description,
                IsSystem = r.IsSystem,
                Sections = sectionsByRoleId.TryGetValue(r.Id, out var secs) ? secs : []
            }).ToList(),
            Users = users.Select(u => new SyncUserDto
            {
                Id = u.Id,
                Username = u.Username,
                PasswordHash = u.PasswordHash,
                FullName = u.FullName,
                RoleName = roleNameById.TryGetValue(u.RoleId, out var rn) ? rn : "Cashier",
                IsActive = u.IsActive,
                MustChangePassword = u.MustChangePassword,
                CreatedAt = u.CreatedAt
            }).ToList()
        };
    }

    public async Task<SyncApplyResultDto> ApplySnapshotAsync(SyncSnapshotDto snapshot, CancellationToken ct = default)
    {
        var syncState = (await _unitOfWork.FindAsync<SyncState>(_ => true, ct)).FirstOrDefault();
        var lastSyncedAt = syncState?.LastSyncedAt;

        var result = new SyncApplyResultDto { AppliedAt = DateTime.UtcNow };

        // Categories (self-referencing ParentCategoryId - EF Core orders the INSERTs correctly
        // within a single SaveChanges since it tracks the FK relationship).
        var existingCategories = (await _unitOfWork.FindAsync<Category>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Categories)
        {
            if (existingCategories.TryGetValue(dto.Id, out var entity))
            {
                entity.Name = dto.Name;
                entity.Description = dto.Description;
                entity.ParentCategoryId = dto.ParentCategoryId;
                entity.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                await _unitOfWork.AddAsync(new Category
                {
                    Id = dto.Id,
                    Name = dto.Name,
                    Description = dto.Description,
                    ParentCategoryId = dto.ParentCategoryId
                }, ct);
            }
            result.CategoriesUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        var existingFournisseurs = (await _unitOfWork.FindAsync<Fournisseur>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Fournisseurs)
        {
            if (existingFournisseurs.TryGetValue(dto.Id, out var entity))
            {
                entity.Nom = dto.Nom;
                entity.Contact = dto.Contact;
                entity.Email = dto.Email;
                entity.Telephone = dto.Telephone;
                entity.Adresse = dto.Adresse;
                entity.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                await _unitOfWork.AddAsync(new Fournisseur
                {
                    Id = dto.Id,
                    Nom = dto.Nom,
                    Contact = dto.Contact,
                    Email = dto.Email,
                    Telephone = dto.Telephone,
                    Adresse = dto.Adresse
                }, ct);
            }
            result.FournisseursUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        var existingColors = (await _unitOfWork.FindAsync<Color>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Colors)
        {
            if (existingColors.TryGetValue(dto.Id, out var entity))
            {
                entity.Name = dto.Name;
                entity.HexCode = dto.HexCode;
                entity.SortOrder = dto.SortOrder;
            }
            else
            {
                await _unitOfWork.AddAsync(new Color { Id = dto.Id, Name = dto.Name, HexCode = dto.HexCode, SortOrder = dto.SortOrder }, ct);
            }
            result.ColorsUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        var existingSizes = (await _unitOfWork.FindAsync<Size>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Sizes)
        {
            if (existingSizes.TryGetValue(dto.Id, out var entity))
            {
                entity.Value = dto.Value;
                entity.SortOrder = dto.SortOrder;
            }
            else
            {
                await _unitOfWork.AddAsync(new Size { Id = dto.Id, Value = dto.Value, SortOrder = dto.SortOrder }, ct);
            }
            result.SizesUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        var existingProducts = (await _unitOfWork.FindAsync<Product>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Products)
        {
            if (existingProducts.TryGetValue(dto.Id, out var entity))
            {
                entity.Name = dto.Name;
                entity.Description = dto.Description;
                entity.Brand = dto.Brand;
                entity.Barcode = dto.Barcode;
                entity.ImageUrl = dto.ImageUrl;
                entity.Price = dto.Price;
                entity.CostPrice = dto.CostPrice;
                entity.LiquidationPrice = dto.LiquidationPrice;
                entity.OnlinePrice = dto.OnlinePrice;
                entity.CategoryId = dto.CategoryId;
                entity.FournisseurId = dto.FournisseurId;
                entity.IsActive = dto.IsActive;
                entity.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                await _unitOfWork.AddAsync(new Product
                {
                    Id = dto.Id,
                    Name = dto.Name,
                    Description = dto.Description,
                    Brand = dto.Brand,
                    Barcode = dto.Barcode,
                    ImageUrl = dto.ImageUrl,
                    Price = dto.Price,
                    CostPrice = dto.CostPrice,
                    LiquidationPrice = dto.LiquidationPrice,
                    OnlinePrice = dto.OnlinePrice,
                    CategoryId = dto.CategoryId,
                    FournisseurId = dto.FournisseurId,
                    IsActive = dto.IsActive
                }, ct);
            }
            result.ProductsUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        // Colourways must land between Products and ProductVariants: a variant's composite FK
        // points at one, so inserting variants first would violate it.
        //
        // Backward compatibility: a sender running a build from before colourways existed sends no
        // ProductColorways array at all, and its variants carry ColorwayId 0. Rather than reject
        // that snapshot, rebuild the colourways from the variants' own (ProductId, ColorId) pairs -
        // which is exactly the information a colourway is made of. Those rebuilt rows get
        // database-assigned Ids rather than invented ones, because the receiver may already hold
        // real colourways whose Ids we must not collide with. A terminal and the VPS can therefore
        // be upgraded in either order without a sync outage.
        var existingColorways = (await _unitOfWork.FindAsync<ProductColorway>(_ => true, ct)).ToList();
        var colorwaysById = existingColorways.ToDictionary(x => x.Id);

        if (snapshot.ProductColorways.Count > 0)
        {
            foreach (var dto in snapshot.ProductColorways)
            {
                if (colorwaysById.TryGetValue(dto.Id, out var entity))
                {
                    entity.ProductId = dto.ProductId;
                    entity.ColorId = dto.ColorId;
                    entity.ImageUrl = dto.ImageUrl;
                    entity.OnlinePrice = dto.OnlinePrice;
                    entity.ShopifyProductId = dto.ShopifyProductId;
                    entity.ShopifyTitle = dto.ShopifyTitle;
                    entity.SortOrder = dto.SortOrder;
                    entity.IsActive = dto.IsActive;
                    entity.UpdatedAt = DateTime.UtcNow;
                }
                else
                {
                    var created = new ProductColorway
                    {
                        Id = dto.Id,
                        ProductId = dto.ProductId,
                        ColorId = dto.ColorId,
                        ImageUrl = dto.ImageUrl,
                        OnlinePrice = dto.OnlinePrice,
                        ShopifyProductId = dto.ShopifyProductId,
                        ShopifyTitle = dto.ShopifyTitle,
                        SortOrder = dto.SortOrder,
                        IsActive = dto.IsActive
                    };
                    await _unitOfWork.AddAsync(created, ct);
                    existingColorways.Add(created);
                }
                result.ProductColorwaysUpserted++;
            }
        }
        else
        {
            var known = existingColorways.Select(c => (c.ProductId, c.ColorId)).ToHashSet();
            var sortByProduct = existingColorways
                .GroupBy(c => c.ProductId)
                .ToDictionary(g => g.Key, g => g.Count());

            foreach (var pair in snapshot.ProductVariants
                         .Select(v => (v.ProductId, v.ColorId))
                         .Distinct())
            {
                if (!known.Add(pair)) continue;

                sortByProduct.TryGetValue(pair.ProductId, out var sort);
                sortByProduct[pair.ProductId] = sort + 1;

                var created = new ProductColorway
                {
                    ProductId = pair.ProductId,
                    ColorId = pair.ColorId,
                    SortOrder = sort,
                    IsActive = true
                };
                await _unitOfWork.AddAsync(created, ct);
                existingColorways.Add(created);
                result.ProductColorwaysUpserted++;
            }
        }
        await _unitOfWork.SaveChangesAsync(ct);

        // Maps (ProductId, ColorId) -> colourway Id. Built from the post-save local rows so it
        // covers both branches above, and so a variant arriving with ColorwayId 0 from an older
        // sender can still be pointed at the right row.
        var colorwayIdByPair = existingColorways
            .GroupBy(c => (c.ProductId, c.ColorId))
            .ToDictionary(g => g.Key, g => g.First().Id);

        var existingVariants = (await _unitOfWork.FindAsync<ProductVariant>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.ProductVariants)
        {
            if (existingVariants.TryGetValue(dto.Id, out var entity))
            {
                entity.ProductId = dto.ProductId;
                entity.ColorId = dto.ColorId;
                entity.ColorwayId = ResolveColorwayId(dto, colorwayIdByPair);
                entity.SizeId = dto.SizeId;
                entity.Sku = dto.Sku;
                entity.Barcode = dto.Barcode;
                entity.ImageUrl = dto.ImageUrl;
                entity.IsActive = dto.IsActive;
                entity.IsLiquidation = dto.IsLiquidation;
                entity.ShopifyVariantId = dto.ShopifyVariantId;
                entity.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                await _unitOfWork.AddAsync(new ProductVariant
                {
                    Id = dto.Id,
                    ProductId = dto.ProductId,
                    ColorId = dto.ColorId,
                    ColorwayId = ResolveColorwayId(dto, colorwayIdByPair),
                    SizeId = dto.SizeId,
                    Sku = dto.Sku,
                    Barcode = dto.Barcode,
                    ImageUrl = dto.ImageUrl,
                    IsActive = dto.IsActive,
                    IsLiquidation = dto.IsLiquidation,
                    ShopifyVariantId = dto.ShopifyVariantId
                }, ct);
            }
            result.ProductVariantsUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        // Stock: the actual conflict-sensitive part. If this variant had ANY movement locally
        // since the last successful sync, something happened here while potentially disconnected
        // from the VPS (a fallback sale, a manual adjustment, a delivery) - don't silently
        // overwrite it with the VPS's value, leave it for the operator to reconcile by hand.
        var recentMovements = lastSyncedAt.HasValue
            ? await _unitOfWork.Stock.GetMovementsAsync(null, lastSyncedAt.Value, null, ct)
            : [];
        var variantIdsWithLocalActivity = recentMovements.Select(m => m.ProductVariantId).ToHashSet();

        var existingStockItems = (await _unitOfWork.FindAsync<StockItem>(_ => true, ct)).ToDictionary(x => x.ProductVariantId);
        foreach (var dto in snapshot.StockItems)
        {
            if (lastSyncedAt.HasValue && variantIdsWithLocalActivity.Contains(dto.ProductVariantId))
            {
                result.StockItemsSkippedDueToLocalActivity++;
                continue;
            }

            if (existingStockItems.TryGetValue(dto.ProductVariantId, out var entity))
            {
                entity.QuantityOnHand = dto.QuantityOnHand;
                entity.QuantityReserved = dto.QuantityReserved;
                entity.ReorderLevel = dto.ReorderLevel;
                entity.ReorderQuantity = dto.ReorderQuantity;
                entity.LastUpdatedAt = dto.LastUpdatedAt;
            }
            else
            {
                await _unitOfWork.AddAsync(new StockItem
                {
                    ProductVariantId = dto.ProductVariantId,
                    QuantityOnHand = dto.QuantityOnHand,
                    QuantityReserved = dto.QuantityReserved,
                    ReorderLevel = dto.ReorderLevel,
                    ReorderQuantity = dto.ReorderQuantity,
                    LastUpdatedAt = dto.LastUpdatedAt
                }, ct);
            }
            result.StockItemsUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        // Clients: identity/contact fields always sync from the VPS. Loyalty fields (points,
        // spend, category) are skipped if this client visited locally since the last sync -
        // same protective principle as stock, applied to the one other place a local fallback
        // sale mutates something that's also part of this snapshot.
        var existingClients = (await _unitOfWork.FindAsync<Client>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Clients)
        {
            if (existingClients.TryGetValue(dto.Id, out var entity))
            {
                var touchedLocally = lastSyncedAt.HasValue
                    && entity.LastVisitAt.HasValue
                    && entity.LastVisitAt.Value > lastSyncedAt.Value;

                entity.Name = dto.Name;
                entity.Phone = dto.Phone;
                entity.Email = dto.Email;
                entity.QrCode = dto.QrCode;
                entity.Tags = dto.Tags;
                entity.City = dto.City;
                entity.AddressLine = dto.AddressLine;
                entity.ShopifyCustomerId = dto.ShopifyCustomerId;
                entity.ShopifyTotalSpent = dto.ShopifyTotalSpent;
                entity.ShopifyOrdersCount = dto.ShopifyOrdersCount;

                if (touchedLocally)
                {
                    result.ClientsSkippedLoyaltyFieldsDueToLocalActivity++;
                }
                else
                {
                    entity.TotalPoints = dto.TotalPoints;
                    entity.LifetimePoints = dto.LifetimePoints;
                    entity.TotalSpent = dto.TotalSpent;
                    entity.LoyaltyRate = dto.LoyaltyRate;
                    entity.LastVisitAt = dto.LastVisitAt;
                    entity.ManualCategory = dto.ManualCategory;
                    entity.ComputedCategory = dto.ComputedCategory;
                    entity.EffectiveCategory = dto.EffectiveCategory;
                    entity.CategoryUpdatedAt = dto.CategoryUpdatedAt;
                }
            }
            else
            {
                await _unitOfWork.AddAsync(new Client
                {
                    Id = dto.Id,
                    Name = dto.Name,
                    Phone = dto.Phone,
                    Email = dto.Email,
                    QrCode = dto.QrCode,
                    TotalPoints = dto.TotalPoints,
                    LifetimePoints = dto.LifetimePoints,
                    TotalSpent = dto.TotalSpent,
                    LoyaltyRate = dto.LoyaltyRate,
                    CreatedAt = dto.CreatedAt,
                    LastVisitAt = dto.LastVisitAt,
                    ShopifyCustomerId = dto.ShopifyCustomerId,
                    Tags = dto.Tags,
                    City = dto.City,
                    AddressLine = dto.AddressLine,
                    ShopifyTotalSpent = dto.ShopifyTotalSpent,
                    ShopifyOrdersCount = dto.ShopifyOrdersCount,
                    ManualCategory = dto.ManualCategory,
                    ComputedCategory = dto.ComputedCategory,
                    EffectiveCategory = dto.EffectiveCategory,
                    CategoryUpdatedAt = dto.CategoryUpdatedAt
                }, ct);
            }
            result.ClientsUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        // Roles travel ahead of Users so a custom role created on the VPS after go-live already
        // exists locally (with the same granted Sections) by the time a User references it.
        var existingRoles = (await _unitOfWork.FindAsync<Role>(_ => true, ct)).ToDictionary(x => x.Name);
        var existingRoleSections = await _unitOfWork.FindAsync<RoleSection>(_ => true, ct);
        foreach (var dto in snapshot.Roles)
        {
            Role roleEntity;
            if (existingRoles.TryGetValue(dto.Name, out var found))
            {
                roleEntity = found;
                roleEntity.Description = dto.Description;
                // IsSystem/Name never change here - system-role identity is fixed everywhere.
            }
            else
            {
                roleEntity = new Role { Name = dto.Name, Description = dto.Description, IsSystem = dto.IsSystem };
                await _unitOfWork.AddAsync(roleEntity, ct);
                existingRoles[dto.Name] = roleEntity;
            }
            result.RolesUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        foreach (var dto in snapshot.Roles)
        {
            var roleEntity = existingRoles[dto.Name];
            var currentSections = existingRoleSections.Where(rs => rs.RoleId == roleEntity.Id).ToList();
            foreach (var stale in currentSections.Where(rs => !dto.Sections.Contains(rs.SectionKey)))
                _unitOfWork.Remove(stale);
            foreach (var missing in dto.Sections.Where(s => !currentSections.Any(rs => rs.SectionKey == s)))
                await _unitOfWork.AddAsync(new RoleSection { RoleId = roleEntity.Id, SectionKey = missing }, ct);
        }
        await _unitOfWork.SaveChangesAsync(ct);

        // Users: the VPS is authoritative for credentials, always overwrite. Password changes
        // made while running on the local fallback (a rare edge case) would be lost on the next
        // sync - acceptable for v1, same as the client-facing loyalty conflict is scoped to stock
        // and visits, not every possible field.
        var existingUsers = (await _unitOfWork.FindAsync<User>(_ => true, ct)).ToDictionary(x => x.Id);
        foreach (var dto in snapshot.Users)
        {
            // Falls back to Cashier if the snapshot ever names a role this side couldn't resolve -
            // never silently grants Admin.
            var roleId = existingRoles.TryGetValue(dto.RoleName, out var role)
                ? role.Id
                : existingRoles["Cashier"].Id;

            if (existingUsers.TryGetValue(dto.Id, out var entity))
            {
                entity.Username = dto.Username;
                entity.PasswordHash = dto.PasswordHash;
                entity.FullName = dto.FullName;
                entity.RoleId = roleId;
                entity.IsActive = dto.IsActive;
                entity.MustChangePassword = dto.MustChangePassword;
            }
            else
            {
                await _unitOfWork.AddAsync(new User
                {
                    Id = dto.Id,
                    Username = dto.Username,
                    PasswordHash = dto.PasswordHash,
                    FullName = dto.FullName,
                    RoleId = roleId,
                    IsActive = dto.IsActive,
                    MustChangePassword = dto.MustChangePassword,
                    CreatedAt = dto.CreatedAt
                }, ct);
            }
            result.UsersUpserted++;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        if (syncState is null)
        {
            await _unitOfWork.AddAsync(new SyncState { LastSyncedAt = result.AppliedAt }, ct);
        }
        else
        {
            syncState.LastSyncedAt = result.AppliedAt;
        }
        await _unitOfWork.SaveChangesAsync(ct);

        return result;
    }

    // A variant from a current sender already names its colourway. One from a pre-colourway sender
    // carries 0, and is matched by the (ProductId, ColorId) pair the colourway was rebuilt from.
    private static int ResolveColorwayId(
        SyncProductVariantDto dto,
        IReadOnlyDictionary<(int ProductId, int ColorId), int> colorwayIdByPair)
    {
        if (dto.ColorwayId != 0) return dto.ColorwayId;

        return colorwayIdByPair.TryGetValue((dto.ProductId, dto.ColorId), out var id)
            ? id
            : throw new InvalidOperationException(
                $"Snapshot variant {dto.Id} references product {dto.ProductId} / colour {dto.ColorId}, " +
                "which has no colourway - the snapshot's products and variants disagree.");
    }
}
