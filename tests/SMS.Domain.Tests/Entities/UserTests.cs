using SMS.Domain.Entities;
using SMS.Domain.Enums;

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
        Assert.Equal(UserRole.Admin, user.Role); // Default enum value is 0 (Admin)
        Assert.True(user.IsActive);
    }

    [Fact]
    public void User_CanSetAllProperties()
    {
        var user = new User
        {
            Id = 1,
            Username = "admin",
            PasswordHash = "hashed_password",
            FullName = "Admin User",
            Role = UserRole.Admin,
            IsActive = true
        };

        Assert.Equal(1, user.Id);
        Assert.Equal("admin", user.Username);
        Assert.Equal("hashed_password", user.PasswordHash);
        Assert.Equal("Admin User", user.FullName);
        Assert.Equal(UserRole.Admin, user.Role);
        Assert.True(user.IsActive);
    }

    [Theory]
    [InlineData(UserRole.Admin)]
    [InlineData(UserRole.Manager)]
    [InlineData(UserRole.Cashier)]
    public void User_SupportsAllRoles(UserRole role)
    {
        var user = new User { Role = role };
        Assert.Equal(role, user.Role);
    }

    [Fact]
    public void User_CanBeDeactivated()
    {
        var user = new User { IsActive = false };
        Assert.False(user.IsActive);
    }
}
