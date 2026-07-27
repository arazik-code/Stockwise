using SMS.Domain.Entities;

namespace SMS.Domain.Tests.Entities;

public class ProductTests
{
    [Fact]
    public void Product_DefaultValues_AreCorrect()
    {
        var product = new Product();

        Assert.Equal(string.Empty, product.Name);
        Assert.True(product.IsActive);
        Assert.Empty(product.Variants);
        Assert.True(product.CreatedAt <= DateTime.UtcNow);
        Assert.True(product.UpdatedAt <= DateTime.UtcNow);
    }

    [Fact]
    public void Product_CanSetAllProperties()
    {
        var product = new Product
        {
            Id = 1,
            Name = "Running Shoe",
            Description = "A comfortable running shoe",
            Brand = "Nike",
            ImageUrl = "/images/shoe.jpg",
            CategoryId = 1,
            FournisseurId = 1,
            IsActive = true
        };

        Assert.Equal(1, product.Id);
        Assert.Equal("Running Shoe", product.Name);
        Assert.Equal("Nike", product.Brand);
    }

    [Fact]
    public void Product_OptionalProperties_CanBeNull()
    {
        var product = new Product
        {
            Description = null,
            Brand = null,
            ImageUrl = null,
            FournisseurId = null,
            Fournisseur = null
        };

        Assert.Null(product.Description);
        Assert.Null(product.Brand);
        Assert.Null(product.ImageUrl);
        Assert.Null(product.FournisseurId);
        Assert.Null(product.Fournisseur);
    }

    [Fact]
    public void Product_HasNavigationProperties()
    {
        var category = new Category { Id = 1, Name = "Shoes" };
        var fournisseur = new Fournisseur { Id = 1, Nom = "Nike" };

        var product = new Product
        {
            CategoryId = 1,
            Category = category,
            FournisseurId = 1,
            Fournisseur = fournisseur
        };

        Assert.NotNull(product.Category);
        Assert.Equal("Shoes", product.Category.Name);
        Assert.NotNull(product.Fournisseur);
        Assert.Equal("Nike", product.Fournisseur.Nom);
    }
}
