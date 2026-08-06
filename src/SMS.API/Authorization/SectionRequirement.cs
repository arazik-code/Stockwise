using Microsoft.AspNetCore.Authorization;

namespace SMS.API.Authorization;

// Additive alongside existing [Authorize(Roles=...)] attributes, not a replacement - see
// RequireSectionAttribute for why. Admin always satisfies every SectionRequirement.
public class SectionRequirement : IAuthorizationRequirement
{
    public string SectionKey { get; }
    public SectionRequirement(string sectionKey) => SectionKey = sectionKey;
}
