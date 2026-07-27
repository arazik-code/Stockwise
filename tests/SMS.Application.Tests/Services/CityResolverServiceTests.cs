using Microsoft.Extensions.Caching.Memory;
using SMS.Application.Services;
using SMS.Domain.Interfaces;

namespace SMS.Application.Tests.Services;

public class CityResolverServiceTests
{
    [Fact]
    public void StaticInitialization_DoesNotThrow()
    {
        // Regression test: the normalized Arabic-city lookup table used to be built with a plain
        // ToDictionary(), which crashed the *entire type* at static-init time (TypeInitializationException,
        // meaning every subsequent call to any method on this class would fail) the moment two
        // entries collapsed to the same key after diacritic-stripping. Found live: NFD-stripping
        // "NonSpacingMark" also strips Arabic hamza marks, so "أكادير" (with hamza) and "اكادير"
        // (plain alef) both normalize to the same key. Forcing static init here (by constructing
        // the service, which touches the class) must never throw.
        var unitOfWork = new Mock<IUnitOfWork>();
        var cache = new MemoryCache(new MemoryCacheOptions());

        var exception = Record.Exception(() => new CityResolverService(unitOfWork.Object, cache));

        Assert.Null(exception);
    }

    [Theory]
    [InlineData("Casablanca")]
    [InlineData("meknes")]
    [InlineData("Salé")]
    public void Normalize_StripsCaseAndLatinDiacritics(string input)
    {
        var result = CityResolverService.Normalize(input);
        Assert.Equal(result.ToLowerInvariant(), result);
    }
}
