namespace SMS.Application.DTOs;

// Distinguishes which role this deployment plays once the VPS-primary architecture is live -
// the VPS build leaves this false (default); the local-fallback desktop build sets it true so
// sales rung up here get tagged for manual reconciliation (see Sale.IsLocalFallbackOrigin).
public class DeploymentOptions
{
    public const string SectionName = "Deployment";
    public bool IsLocalFallback { get; set; }
}
