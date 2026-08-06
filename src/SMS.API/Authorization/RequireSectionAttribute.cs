using Microsoft.AspNetCore.Authorization;

namespace SMS.API.Authorization;

// [RequireSection(Sections.Products)] on a controller/action - additive alongside the existing
// [Authorize(Roles="Admin,StockManager")] attributes, not a replacement. System roles (Admin/
// Cashier/StockManager) are seeded with Sections that exactly reproduce today's real Roles-based
// access, so this is a no-op for existing users; it's what makes a brand-new custom Role's section
// grants actually enforced server-side rather than just hidden in the UI.
public class RequireSectionAttribute : AuthorizeAttribute
{
    public RequireSectionAttribute(string sectionKey) : base($"Section:{sectionKey}") { }
}
