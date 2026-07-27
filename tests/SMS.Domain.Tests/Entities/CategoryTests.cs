using SMS.Domain.Entities;

namespace SMS.Domain.Tests.Entities;

public class CategoryTests
{
    [Fact]
    public void Category_DefaultValues_AreCorrect()
    {
        var category = new Category();

        Assert.Equal(string.Empty, category.Name);
        Assert.Null(category.Description);
        Assert.Null(category.ParentCategoryId);
        Assert.Null(category.ParentCategory);
        Assert.Empty(category.SubCategories);
        Assert.Empty(category.Products);
    }

    [Fact]
    public void Category_SupportsHierarchy()
    {
        var parentCategory = new Category { Id = 1, Name = "Footwear" };
        var childCategory = new Category
        {
            Id = 2,
            Name = "Running Shoes",
            ParentCategoryId = 1,
            ParentCategory = parentCategory
        };

        parentCategory.SubCategories.Add(childCategory);

        Assert.Single(parentCategory.SubCategories);
        Assert.Equal("Running Shoes", parentCategory.SubCategories.First().Name);
        Assert.Equal(1, childCategory.ParentCategoryId);
    }

    [Fact]
    public void Category_CanHaveProducts()
    {
        var category = new Category { Id = 1, Name = "Shoes" };
        var product1 = new Product { Id = 1, Name = "Shoe A" };
        var product2 = new Product { Id = 2, Name = "Shoe B" };

        category.Products.Add(product1);
        category.Products.Add(product2);

        Assert.Equal(2, category.Products.Count);
    }

    [Fact]
    public void Category_Timestamps_DefaultToUtcNow()
    {
        var before = DateTime.UtcNow;
        var category = new Category();
        var after = DateTime.UtcNow;

        Assert.InRange(category.CreatedAt, before, after);
        Assert.InRange(category.UpdatedAt, before, after);
    }
}
