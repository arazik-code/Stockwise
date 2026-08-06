using SMS.Domain.Entities;

namespace SMS.Domain.Tests.Entities;

public class UserTests
{
    [Fact]
    public void User_DefaultValues_AreCorrect()
    {
        var user = new User();

        Assert.Equal(string.Empty, user.Username);
        Assert.Equal(string.Empty, user.PasswordHash);
        Assert.Equal(string.Empty, user.FullName);
        Assert.Equal(0, user.RoleId);
        Assert.True(user.IsActive);
    }

    [Fact]
    public void User_CanSetAllProperties()
    {
        var role = new Role { Id = 1, Name = "Admin", IsSystem = true };
        var user = new User
        {
            Id = 1,
            Username = "admin",
            PasswordHash = "hashed_password",
            FullName = "Admin User",
            RoleId = role.Id,
            Role = role,
            IsActive = true
        };

        Assert.Equal(1, user.Id);
        Assert.Equal("admin", user.Username);
        Assert.Equal("hashed_password", user.PasswordHash);
        Assert.Equal("Admin User", user.FullName);
        Assert.Equal("Admin", user.Role.Name);
        Assert.True(user.IsActive);
    }

    [Theory]
    [InlineData("Admin")]
    [InlineData("Cashier")]
    [InlineData("StockManager")]
    [InlineData("Comptable")]
    public void User_SupportsAnyRoleName(string roleName)
    {
        var role = new Role { Name = roleName };
        var user = new User { Role = role };
        Assert.Equal(roleName, user.Role.Name);
    }

    [Fact]
    public void User_CanBeDeactivated()
    {
        var user = new User { IsActive = false };
        Assert.False(user.IsActive);
    }
}
