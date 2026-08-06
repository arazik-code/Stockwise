using SMS.Domain.Security;

namespace SMS.Domain.Tests.Security;

public class PasswordHasherTests
{
    [Fact]
    public void Hash_ThenVerify_RoundTrips()
    {
        var hash = PasswordHasher.Hash("Correct-Horse1!");
        Assert.True(PasswordHasher.Verify("Correct-Horse1!", hash));
    }

    [Fact]
    public void Verify_WrongPassword_ReturnsFalse()
    {
        var hash = PasswordHasher.Hash("Correct-Horse1!");
        Assert.False(PasswordHasher.Verify("wrong-password", hash));
    }

    [Fact]
    public void Hash_SamePasswordTwice_ProducesDifferentHashes()
    {
        // Random salt per call - two hashes of the same password must never be byte-identical.
        var a = PasswordHasher.Hash("SamePassword1!");
        var b = PasswordHasher.Hash("SamePassword1!");
        Assert.NotEqual(a, b);
    }

    [Theory]
    [InlineData(200)]
    public void GenerateTempPassword_AlwaysSatisfiesPasswordPolicy(int iterations)
    {
        // Regression guard: an earlier draft drew 14 fully-random characters, which could
        // statistically miss a required category (e.g. no digit) and fail the very policy the
        // generated password is meant to satisfy. Run many iterations to catch that reliably.
        for (var i = 0; i < iterations; i++)
        {
            var pwd = PasswordHasher.GenerateTempPassword();
            var error = PasswordPolicy.Validate(pwd);
            Assert.True(error is null, $"Generated password '{pwd}' failed policy: {error}");
        }
    }
}
