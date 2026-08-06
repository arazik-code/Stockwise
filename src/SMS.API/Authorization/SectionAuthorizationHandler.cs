using Microsoft.AspNetCore.Authorization;

namespace SMS.API.Authorization;

public class SectionAuthorizationHandler : AuthorizationHandler<SectionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, SectionRequirement requirement)
    {
        if (context.User.IsInRole("Admin"))
        {
            context.Succeed(requirement);
            return Task.CompletedTask;
        }

        var hasSection = context.User.Claims.Any(c => c.Type == "section" && c.Value == requirement.SectionKey);
        if (hasSection)
            context.Succeed(requirement);

        return Task.CompletedTask;
    }
}
