namespace SMS.Application.Common;

// Generates valid, scannable EAN-13 barcodes in the "internal use" prefix range (20–29),
// with a correct check digit and guaranteed uniqueness against a caller-supplied set.
public static class BarcodeGenerator
{
    public static string GenerateEan13(HashSet<string> used)
    {
        string code;
        do
        {
            // "22" internal-use prefix + 10 random digits = 12 data digits.
            var body = "22" + Random.Shared.NextInt64(0, 10_000_000_000L).ToString("D10");
            code = body + CheckDigit(body);
        }
        while (!used.Add(code));
        return code;
    }

    private static char CheckDigit(string twelveDigits)
    {
        var sum = 0;
        for (var i = 0; i < 12; i++)
        {
            var d = twelveDigits[i] - '0';
            sum += i % 2 == 0 ? d : d * 3;
        }
        var check = (10 - sum % 10) % 10;
        return (char)('0' + check);
    }
}
