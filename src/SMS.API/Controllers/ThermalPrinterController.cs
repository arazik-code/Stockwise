using System.Net.Sockets;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SMS.Application.DTOs.Printer;
using SMS.Application.DTOs.Products;
using SMS.Application.Interfaces;
using SMS.Application.Services;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/printer")]
[Authorize]
public class ThermalPrinterController : ControllerBase
{
    private readonly ThermalPrinterService _printerService;
    private readonly IProductService _productService;
    private readonly IConfiguration _configuration;

    public ThermalPrinterController(ThermalPrinterService printerService, IProductService productService, IConfiguration configuration)
    {
        _printerService = printerService;
        _productService = productService;
        _configuration = configuration;
    }

    [HttpGet("label-sizes")]
    public ActionResult<List<LabelSizeOption>> GetSupportedLabelSizes()
    {
        return Ok(ThermalPrinterService.SupportedLabelSizes);
    }

    [HttpPost("generate-tspl")]
    public ActionResult<TsplCommandResponse> GenerateTspl([FromBody] GenerateBatchLabelsRequest request)
    {
        if (request.Labels == null || request.Labels.Count == 0)
            return BadRequest(new { message = "Aucune étiquette spécifiée" });

        var result = _printerService.GeneratePreviewCommand(request);
        return Ok(result);
    }

    [HttpPost("test-print")]
    public ActionResult<object> TestPrint([FromQuery] string? labelCode = null)
    {
        var labelSize = ThermalPrinterService.SupportedLabelSizes
            .FirstOrDefault(s => s.Code == labelCode)
            ?? ThermalPrinterService.SupportedLabelSizes[0];

        var testLabel = new ThermalLabelData(
            "Test Produit",
            "Noir",
            "42",
            "TST-001",
            "TEST123456789",
            "MAD 299.99",
            1
        );

        var tspl = _printerService.GenerateTsplLabel(testLabel, labelSize);

        return Ok(new
        {
            tspl,
            labelSize = $"{labelSize.WidthMm}x{labelSize.HeightMm}mm",
            printer = "TSC TTP-247",
            message = "TSPL command generated. Send to printer via USB/Network."
        });
    }

    [HttpPost("calibrate")]
    public ActionResult<object> Calibrate()
    {
        var tspl = _printerService.GenerateCalibrationCommand();
        return Ok(new { tspl, message = "Calibration command generated" });
    }

    [HttpPost("variant/{variantId}/label")]
    public async Task<ActionResult<TsplCommandResponse>> GenerateVariantLabel(
        int variantId,
        [FromQuery] string labelCode = "50x30",
        [FromQuery] int copies = 1,
        CancellationToken ct = default)
    {
        // Find variant across all products
        var allProducts = await _productService.GetAllAsync(ct);
        ProductVariantDto? foundVariant = null;
        string productName = "";
        foreach (var p in allProducts)
        {
            var v = p.Variants.FirstOrDefault(x => x.Id == variantId);
            if (v != null)
            {
                foundVariant = v;
                productName = p.Name;
                break;
            }
        }

        if (foundVariant == null)
            return NotFound(new { message = "Variante non trouvée" });

        var request = new GenerateBatchLabelsRequest(
            Labels:
            [
                new GenerateLabelRequest(
                    ProductVariantId: foundVariant.Id,
                    ProductName: productName,
                    ColorName: foundVariant.ColorName,
                    SizeValue: foundVariant.SizeValue,
                    Sku: foundVariant.Sku,
                    Barcode: foundVariant.Barcode ?? "",
                    Price: foundVariant.Price,
                    Quantity: 1,
                    LabelCode: labelCode
                )
            ],
            LabelCode: labelCode,
            CopiesPerLabel: copies
        );

        var result = _printerService.GeneratePreviewCommand(request);
        return Ok(result);
    }

    [HttpPost("product/{productId}/labels")]
    public async Task<ActionResult<TsplCommandResponse>> GenerateProductLabels(
        int productId,
        [FromQuery] string labelCode = "50x30",
        [FromQuery] int copiesPerVariant = 1,
        CancellationToken ct = default)
    {
        var product = await _productService.GetByIdAsync(productId, ct);
        if (product == null)
            return NotFound(new { message = "Produit non trouvé" });

        var labels = product.Variants
            .Where(v => !string.IsNullOrEmpty(v.Barcode))
            .Select(v => new GenerateLabelRequest(
                ProductVariantId: v.Id,
                ProductName: product.Name,
                ColorName: v.ColorName,
                SizeValue: v.SizeValue,
                Sku: v.Sku,
                Barcode: v.Barcode ?? "",
                Price: v.Price,
                Quantity: 1,
                LabelCode: labelCode
            )).ToList();

        if (labels.Count == 0)
            return BadRequest(new { message = "Aucune variante avec code-barres pour ce produit" });

        var request = new GenerateBatchLabelsRequest(labels, labelCode, copiesPerVariant);
        var result = _printerService.GeneratePreviewCommand(request);
        return Ok(result);
    }

    [HttpPost("batch")]
    public ActionResult<TsplCommandResponse> GenerateBatchLabels([FromBody] GenerateBatchLabelsRequest request)
    {
        if (request.Labels == null || request.Labels.Count == 0)
            return BadRequest(new { message = "Aucune étiquette spécifiée" });

        var result = _printerService.GeneratePreviewCommand(request);
        return Ok(result);
    }

    [HttpPost("print")]
    public async Task<ActionResult<object>> PrintToPrinter([FromBody] GenerateBatchLabelsRequest request, CancellationToken ct)
    {
        if (request.Labels == null || request.Labels.Count == 0)
            return BadRequest(new { message = "Aucune étiquette spécifiée" });

        var result = _printerService.GeneratePreviewCommand(request);
        var tspl = result.TsplCommands;

        var connectionType = _configuration["Printer:ConnectionType"] ?? "TCP";
        bool sent;

        if (connectionType.Equals("USB", StringComparison.OrdinalIgnoreCase))
        {
            var queueName = _configuration["Printer:CupsQueueName"] ?? _configuration["Printer:WindowsShareName"] ?? "TSC-TTP-247";
            sent = await _printerService.SendToUsbPrinterAsync(tspl, queueName, ct);

            if (!sent)
            {
                var shareName = _configuration["Printer:WindowsShareName"] ?? "TSC TTP-247";
                sent = await _printerService.SendToPrinterViaWindowsAsync(tspl, shareName, ct);
            }

            return Ok(new
            {
                sent,
                tspl,
                connectionType = "USB",
                printer = connectionType,
                message = sent ? "Étiquette envoyée via USB" : "Imprimante USB non accessible - vérifiez le partage Windows"
            });
        }
        else
        {
            var printerIp = _configuration["Printer:IpAddress"] ?? "192.168.1.100";
            var printerPort = int.TryParse(_configuration["Printer:Port"], out var p) ? p : 9100;

            sent = await _printerService.SendToPrinterAsync(tspl, printerIp, printerPort, ct: ct);

            return Ok(new
            {
                sent,
                tspl,
                connectionType = "TCP",
                printer = $"{printerIp}:{printerPort}",
                message = sent ? "Étiquette envoyée à l'imprimante" : "Imprimante non accessible"
            });
        }
    }

    [HttpPost("variant/{variantId}/print")]
    public async Task<ActionResult<object>> PrintVariantLabel(
        int variantId,
        [FromQuery] string labelCode = "50x30",
        [FromQuery] int copies = 1,
        CancellationToken ct = default)
    {
        var allProducts = await _productService.GetAllAsync(ct);
        ProductVariantDto? foundVariant = null;
        string productName = "";
        foreach (var p in allProducts)
        {
            var v = p.Variants.FirstOrDefault(x => x.Id == variantId);
            if (v != null)
            {
                foundVariant = v;
                productName = p.Name;
                break;
            }
        }

        if (foundVariant == null)
            return NotFound(new { message = "Variante non trouvée" });

        var request = new GenerateBatchLabelsRequest(
            Labels: [new GenerateLabelRequest(
                ProductVariantId: foundVariant.Id,
                ProductName: productName,
                ColorName: foundVariant.ColorName,
                SizeValue: foundVariant.SizeValue,
                Sku: foundVariant.Sku,
                Barcode: foundVariant.Barcode ?? "",
                Price: foundVariant.Price,
                Quantity: 1,
                LabelCode: labelCode
            )],
            LabelCode: labelCode,
            CopiesPerLabel: copies
        );

        var result = _printerService.GeneratePreviewCommand(request);
        var tspl = result.TsplCommands;

        var connectionType = _configuration["Printer:ConnectionType"] ?? "TCP";
        bool sent;

        if (connectionType.Equals("USB", StringComparison.OrdinalIgnoreCase))
        {
            var queueName = _configuration["Printer:CupsQueueName"] ?? _configuration["Printer:WindowsShareName"] ?? "TSC-TTP-247";
            sent = await _printerService.SendToUsbPrinterAsync(tspl, queueName, ct);
            if (!sent)
            {
                var shareName = _configuration["Printer:WindowsShareName"] ?? "TSC TTP-247";
                sent = await _printerService.SendToPrinterViaWindowsAsync(tspl, shareName, ct);
            }
            return Ok(new
            {
                sent,
                tspl,
                connectionType = "USB",
                printer = connectionType,
                message = sent ? $"Étiquette {foundVariant.Sku} envoyée via USB" : "Imprimante USB non accessible"
            });
        }
        else
        {
            var printerIp = _configuration["Printer:IpAddress"] ?? "192.168.1.100";
            var printerPort = int.TryParse(_configuration["Printer:Port"], out var pt) ? pt : 9100;
            sent = await _printerService.SendToPrinterAsync(tspl, printerIp, printerPort, ct: ct);
            return Ok(new
            {
                sent,
                tspl,
                connectionType = "TCP",
                printer = $"{printerIp}:{printerPort}",
                message = sent ? $"Étiquette {foundVariant.Sku} envoyée" : "Imprimante non accessible"
            });
        }
    }
}
