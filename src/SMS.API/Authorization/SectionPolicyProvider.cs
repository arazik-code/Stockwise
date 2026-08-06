using Microsoft.AspNetCore.Authorization;

namespace SMS.API.Authorization;

// Dynamically builds a policy for any "Section:<key>" name so a new custom Role/Section pairing
// never requires a matching AddPolicy() call in Program.cs - the fixed Sections list already
// enumerates every valid key, this just wires each one up on demand.
public class SectionPolicyProvider : IAuthorizationPolicyProvider
{
    private const string Prefix = "Section:";
    private readonly DefaultAuthorizationPolicyProvider _fallback;

    public SectionPolicyProvider(Microsoft.Extensions.Options.IOptions<AuthorizationOptions> options)
    {
        _fallback = new DefaultAuthorizationPolicyProvider(options);
    }

    public Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (policyName.StartsWith(Prefix, StringComparison.Ordinal))
        {
            var sectionKey = policyName[Prefix.Length..];
            var policy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddRequirements(new SectionRequirement(sectionKey))
                .Build();
            return Task.FromResult<AuthorizationPolicy?>(policy);
        }
        return _fallback.GetPolicyAsync(policyName);
    }

    public Task<AuthorizationPolicy> GetDefaultPolicyAsync() => _fallback.GetDefaultPolicyAsync();
    public Task<AuthorizationPolicy?> GetFallbackPolicyAsync() => _fallback.GetFallbackPolicyAsync();
}
