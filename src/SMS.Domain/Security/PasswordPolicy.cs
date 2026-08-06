using System.Text.RegularExpressions;

namespace SMS.Domain.Security;

// Single source of truth for password strength - previously duplicated inline in AuthController.
public static class PasswordPolicy
{
    public static string? Validate(string password)
    {
        if (string.IsNullOrWhiteSpace(password))
            return "Le mot de passe est requis";
        if (password.Length < 8)
            return "Le mot de passe doit contenir au moins 8 caracteres";
        if (password.Length > 128)
            return "Le mot de passe ne doit pas depasser 128 caracteres";
        if (!Regex.IsMatch(password, "[A-Z]"))
            return "Le mot de passe doit contenir au moins une lettre majuscule";
        if (!Regex.IsMatch(password, "[a-z]"))
            return "Le mot de passe doit contenir au moins une lettre minuscule";
        if (!Regex.IsMatch(password, "[0-9]"))
            return "Le mot de passe doit contenir au moins un chiffre";
        if (!Regex.IsMatch(password, @"[!@#$%^&*()_+\-=\[\]{};':""\\|,.<>\/?]"))
            return "Le mot de passe doit contenir au moins un caractere special (!@#$%^&*...)";
        return null;
    }
}
