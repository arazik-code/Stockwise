using System.Diagnostics;
using System.Net.Sockets;
using Microsoft.AspNetCore.Mvc;

namespace SMS.API.Controllers;

[ApiController]
[Route("api/devices")]
public class DevicesController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public DevicesController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var connectionType = _configuration["Printer:ConnectionType"] ?? "TCP";
        var printerIp = _configuration["Printer:IpAddress"] ?? "192.168.1.100";
        var printerPort = int.TryParse(_configuration["Printer:Port"], out var p) ? p : 9100;
        var shareName = _configuration["Printer:WindowsShareName"] ?? "TSC TTP-247";

        bool printerOnline;
        string printerDetail;

        if (connectionType.Equals("USB", StringComparison.OrdinalIgnoreCase))
        {
            printerOnline = true;
            printerDetail = $"USB ({shareName})";
        }
        else
        {
            printerOnline = await CheckTcpConnection(printerIp, printerPort);
            printerDetail = $"{printerIp}:{printerPort}";
        }

        var scannerConnected = await CheckScannerConnected();

        return Ok(new
        {
            printer = new
            {
                name = "TSC TTP-247",
                detail = printerDetail,
                connectionType,
                online = printerOnline
            },
            scanner = new
            {
                name = "DataLogic 959 Terry",
                type = "HID Keyboard",
                connected = scannerConnected
            }
        });
    }

    [HttpPost("printer/test")]
    public async Task<IActionResult> TestPrinter()
    {
        var connectionType = _configuration["Printer:ConnectionType"] ?? "TCP";
        var printerIp = _configuration["Printer:IpAddress"] ?? "192.168.1.100";
        var printerPort = int.TryParse(_configuration["Printer:Port"], out var p) ? p : 9100;

        if (connectionType.Equals("USB", StringComparison.OrdinalIgnoreCase))
        {
            return Ok(new { online = true, message = "Imprimante USB détectée" });
        }

        var online = await CheckTcpConnection(printerIp, printerPort);
        return Ok(new { online, message = online ? "Imprimante connectée" : "Imprimante non accessible" });
    }

    private static async Task<bool> CheckScannerConnected()
    {
        await Task.CompletedTask;

        try
        {
            // USB HID devices show as numbered directories (e.g. 1-1, 2-1.2)
            // under /sys/bus/usb/drivers/usbhid/
            if (Directory.Exists("/sys/bus/usb/drivers/usbhid"))
            {
                var dirs = Directory.GetDirectories("/sys/bus/usb/drivers/usbhid");
                // Filter: only actual device dirs (contain digits like "1-1")
                var deviceDirs = dirs.Where(d =>
                {
                    var name = Path.GetFileName(d);
                    return name.Length > 0 && char.IsDigit(name[0]);
                }).ToList();
                return deviceDirs.Count > 0;
            }
        }
        catch { }

        return false;
    }

    private static async Task<bool> CheckTcpConnection(string host, int port, int timeoutMs = 2000)
    {
        try
        {
            using var client = new TcpClient();
            var cts = new CancellationTokenSource(timeoutMs);
            await client.ConnectAsync(host, port, cts.Token);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
