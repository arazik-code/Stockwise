using System.Diagnostics;
using System.Net.Sockets;
using System.Text;
using SMS.Application.DTOs.Printer;

namespace SMS.Application.Services;

public class ThermalPrinterService
{
    // TSC TTP-247: 203 DPI = 8 dots/mm
    private const int DotsPerMm = 8;

    public static readonly List<LabelSizeOption> SupportedLabelSizes =
    [
        new("50x25mm (Standard)", "50x25", 50, 25, 400, 200),
        new("40x30mm (Compact)", "40x30", 40, 30, 320, 240),
        new("60x40mm (Large)", "60x40", 60, 40, 480, 320),
        new("70x50mm (XL)", "70x50", 70, 50, 560, 400),
        new("100x50mm (Wide)", "100x50", 100, 50, 800, 400),
    ];

    public string GenerateTsplLabel(ThermalLabelData label, LabelSizeOption labelSize, int copies = 1)
    {
        var sb = new StringBuilder();
        var priceStr = label.FormattedPrice.Replace("MAD", "").Trim();

        // Labels loaded portrait (50mm along feed, 25mm across)
        // SIZE first param = width across paper, second = height along feed
        // Content rotated 90° so it reads landscape when label is held sideways
        sb.AppendLine($"SIZE {labelSize.HeightMm} mm, {labelSize.WidthMm} mm");
        sb.AppendLine("GAP 2 mm, 0");
        sb.AppendLine("DIRECTION 0");
        sb.AppendLine("CLS");

        // Portrait coords: 25mm wide (200 dots) × 50mm tall (400 dots)
        // Layout: Color/Size (leftmost, big) → Product Name → Barcode → Price
        var w = labelSize.HeightDots;
        var h = labelSize.WidthDots;

        var margin = 6;
        var pos = margin;

        // Color / Size — max left, bold large (2,2)
        var details = $"{label.ColorName} / {label.SizeValue}";
        sb.AppendLine($"TEXT {pos},{h - margin},\"T\",90,2,2,\"{EscapeTspl(details)}\"");
        pos += 32;

        // Product name
        sb.AppendLine($"TEXT {pos},{h - margin},\"T\",90,1,1,\"{EscapeTspl(label.ProductName)}\"");
        pos += 20;

        // Barcode
        var barcodeX = pos;
        var barcodeHeight = 32;
        var narrowBar = 2;
        var wideBar = 4;
        sb.AppendLine($"BARCODE {barcodeX},{h - margin},\"128\",{barcodeHeight},0,90,{narrowBar},{wideBar},\"{EscapeTspl(label.Barcode)}\"");
        pos += barcodeHeight + 4;

        // Price — bold large (2,2), pushed 2mm right
        if (!string.IsNullOrEmpty(priceStr))
        {
            sb.AppendLine($"TEXT {pos + 16},{h - margin},\"T\",90,2,2,\"{EscapeTspl(priceStr + " DH")}\"");
        }

        // Quantity
        if (label.Quantity > 1)
        {
            sb.AppendLine($"TEXT {pos},{h - margin},\"T\",90,1,1,\"x{label.Quantity}\"");
        }

        sb.AppendLine($"PRINT {copies}");
        return sb.ToString();
    }

    public string GenerateBatchTspl(GenerateBatchLabelsRequest request, LabelSizeOption? overrideSize = null)
    {
        var labelSize = overrideSize
            ?? SupportedLabelSizes.FirstOrDefault(s => s.Code == request.LabelCode)
            ?? SupportedLabelSizes[0];

        var sb = new StringBuilder();

        // TSPL setup - only once at the beginning
        sb.AppendLine($"SIZE {labelSize.WidthMm} mm, {labelSize.HeightMm} mm");
        sb.AppendLine("GAP 3 mm, 0");
        sb.AppendLine("DIRECTION 1");
        sb.AppendLine("CLS");

        foreach (var label in request.Labels)
        {
            if (string.IsNullOrEmpty(label.Barcode)) continue;

            var labelData = new ThermalLabelData(
                label.ProductName,
                label.ColorName,
                label.SizeValue,
                label.Sku,
                label.Barcode,
                $"MAD {label.Price:N2}",
                label.Quantity
            );

            // Generate individual label content (without header/footer)
            var labelContent = GenerateLabelContent(labelData, labelSize);
            sb.Append(labelContent);

            // Print command for this label
            sb.AppendLine($"PRINT {request.CopiesPerLabel}");
        }

        return sb.ToString();
    }

    private string GenerateLabelContent(ThermalLabelData label, LabelSizeOption labelSize)
    {
        var sb = new StringBuilder();
        var marginX = 10;
        var marginY = 8;

        // Product name
        sb.AppendLine($"TEXT {marginX},{marginY},\"T\",0,1,1,\"{EscapeTspl(label.ProductName)}\"");

        // Color · Size
        sb.AppendLine($"TEXT {marginX},{marginY + 28},\"T\",0,1,1,\"{EscapeTspl(label.ColorName + " · " + label.SizeValue)}\"");

        // SKU
        sb.AppendLine($"TEXT {marginX},{marginY + 56},\"T\",0,1,1,\"SKU: {EscapeTspl(label.Sku)}\"");

        // Barcode - CODE128
        var barcodeX = marginX;
        var barcodeY = marginY + 84;
        var barcodeHeight = 50;
        var narrowBar = 2;
        var wideBar = 5;
        sb.AppendLine($"BARCODE {barcodeX},{barcodeY},\"128\",{barcodeHeight},1,0,{narrowBar},{wideBar},\"{EscapeTspl(label.Barcode)}\"");

        // Price
        var priceStr = label.FormattedPrice.Replace("MAD", "").Trim();
        if (!string.IsNullOrEmpty(priceStr))
        {
            var priceX = labelSize.WidthDots - (marginX * 2) - 80;
            var priceY = barcodeY + barcodeHeight + 16;
            sb.AppendLine($"TEXT {priceX},{priceY},\"T\",0,2,2,\"{EscapeTspl(priceStr + " DH")}\"");
        }

        // Quantity
        if (label.Quantity > 1)
        {
            sb.AppendLine($"TEXT {marginX},{barcodeY + barcodeHeight + 16},\"T\",0,1,1,\"x{label.Quantity}\"");
        }

        return sb.ToString();
    }

    public TsplCommandResponse GeneratePreviewCommand(GenerateBatchLabelsRequest request)
    {
        var labelSize = SupportedLabelSizes.FirstOrDefault(s => s.Code == request.LabelCode)
            ?? SupportedLabelSizes[0];

        var commands = GenerateBatchTspl(request, labelSize);

        return new TsplCommandResponse(
            TsplCommands: commands,
            LabelCount: request.Labels.Count,
            LabelSize: $"{labelSize.WidthMm}x{labelSize.HeightMm}mm",
            PrinterModel: "TSC TTP-247"
        );
    }

    private static string EscapeTspl(string text)
    {
        return text.Replace("\"", "").Replace("\\", "").Replace("\n", " ").Replace("\r", "");
    }

    public string GenerateCalibrationCommand()
    {
        return "SIZE 50 mm, 30 mm\nGAP 3 mm, 0\nCLS\nPRINT 1\n";
    }

    public string GenerateTestLabelCommand()
    {
        var sb = new StringBuilder();
        sb.AppendLine("SIZE 50 mm, 30 mm");
        sb.AppendLine("GAP 3 mm, 0");
        sb.AppendLine("DIRECTION 1");
        sb.AppendLine("CLS");
        sb.AppendLine("TEXT 10,8,\"T\",0,1,1,\"TEST LABEL\"");
        sb.AppendLine("TEXT 10,36,\"T\",0,1,1,\"TSC TTP-247\"");
        sb.AppendLine("TEXT 10,64,\"T\",0,1,1,\"Stock Management System\"");
        sb.AppendLine("BARCODE 10,92,\"128\",50,1,0,2,5,\"SMS-TEST-2024\"");
        sb.AppendLine("PRINT 1");
        return sb.ToString();
    }

    public string GenerateStatusCommand()
    {
        return "OUT \"TSC TTP-247 READY\"\n";
    }

    public async Task<bool> SendToPrinterAsync(string tsplCommands, string ipAddress, int port = 9100, int timeoutMs = 5000, CancellationToken ct = default)
    {
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(ipAddress, port, ct);
            var bytes = Encoding.ASCII.GetBytes(tsplCommands);
            await client.GetStream().WriteAsync(bytes, ct);
            await client.GetStream().FlushAsync(ct);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SendToUsbPrinterAsync(string tsplCommands, string printerName, CancellationToken ct = default)
    {
        try
        {
            var tempFile = Path.GetTempFileName() + ".prn";
            try
            {
                await File.WriteAllTextAsync(tempFile, tsplCommands, Encoding.ASCII, ct);

                var psi = new ProcessStartInfo
                {
                    FileName = "lp",
                    Arguments = $"-d \"{printerName}\" -o raw \"{tempFile}\"",
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };

                using var process = Process.Start(psi);
                if (process == null) return false;

                await process.WaitForExitAsync(ct);
                var exitCode = process.ExitCode;
                return exitCode == 0;
            }
            finally
            {
                if (File.Exists(tempFile))
                    File.Delete(tempFile);
            }
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> SendToPrinterViaWindowsAsync(string tsplCommands, string shareName, CancellationToken ct = default)
    {
        try
        {
            var tempFile = Path.GetTempFileName() + ".prn";
            try
            {
                await File.WriteAllTextAsync(tempFile, tsplCommands, Encoding.ASCII, ct);

            var psi = new ProcessStartInfo
            {
                FileName = "smbclient",
                Arguments = $"\\\\localhost\\\"{shareName}\" -U \"\" -c \"put \\\"{tempFile}\\\" print\" -N",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };

            using var process = Process.Start(psi);
            if (process == null) return false;

            await process.WaitForExitAsync(ct);
            return process.ExitCode == 0;
            }
            finally
            {
                if (File.Exists(tempFile))
                    File.Delete(tempFile);
            }
        }
        catch
        {
            return false;
        }
    }
}
