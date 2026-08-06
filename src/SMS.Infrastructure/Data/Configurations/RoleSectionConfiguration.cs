using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using SMS.Domain.Entities;

namespace SMS.Infrastructure.Data.Configurations;

public class RoleSectionConfiguration : IEntityTypeConfiguration<RoleSection>
{
    public void Configure(EntityTypeBuilder<RoleSection> builder)
    {
        builder.HasKey(s => new { s.RoleId, s.SectionKey });
        builder.Property(s => s.SectionKey).IsRequired().HasMaxLength(50);
    }
}
