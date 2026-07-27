namespace SMS.Application.DTOs.Printer;

public record LabelSizeOption(
    string Name,
    string Code,
    int WidthMm,
    int HeightMm,
    int WidthDots,
    int HeightDots
);

public record ThermalPrinterConfig(
    string PrinterName,
    string ConnectionType,
    string? IpAddress,
    int? Port,
    int Dpi,
    int Speed,
    int Density,
    int LabelWidth,
    int LabelHeight,
    string LabelCode
);

public record GenerateLabelRequest(
    int ProductVariantId,
    string ProductName,
    string ColorName,
    string SizeValue,
    string Sku,
    string Barcode,
    decimal Price,
    int Quantity,
    string LabelCode
);

public record GenerateBatchLabelsRequest(
    List<GenerateLabelRequest> Labels,
    string LabelCode,
    int CopiesPerLabel
);

public record TsplCommandResponse(
    string TsplCommands,
    int LabelCount,
    string LabelSize,
    string PrinterModel
);

public record ThermalLabelData(
    string ProductName,
    string ColorName,
    string SizeValue,
    string Sku,
    string Barcode,
    string FormattedPrice,
    int Quantity
);
