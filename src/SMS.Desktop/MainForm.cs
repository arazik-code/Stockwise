using System.Diagnostics;
using System.Net.Http;
using Microsoft.Web.WebView2.Core;

namespace SMS.Desktop;

public partial class MainForm : Form
{
    private Process? _apiProcess;
    private readonly int _apiPort = 5001;
    private readonly string _baseUrl;
    private Panel _loadingPanel = null!;
    private Label _statusLabel = null!;
    private Label _subtitleLabel = null!;
    private ProgressBar _progressBar = null!;
    private Microsoft.Web.WebView2.WinForms.WebView2 _webView = null!;

    public MainForm()
    {
        _baseUrl = $"http://localhost:{_apiPort}";
        InitializeUI();
        Load += OnFormLoad;
        FormClosing += OnFormClosing;
    }

    private void InitializeUI()
    {
        SuspendLayout();

        Text = "FlexShoes Stock";
        Size = new Size(1440, 920);
        MinimumSize = new Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(15, 23, 42);

        try
        {
            var iconPath = Path.Combine(AppContext.BaseDirectory, "icon.ico");
            if (File.Exists(iconPath))
                Icon = new Icon(iconPath);
        }
        catch { }

        _loadingPanel = new Panel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.FromArgb(15, 23, 42),
            Visible = true
        };

        var logoLabel = new Label
        {
            Text = "FLEX SHOES",
            Font = new Font("Segoe UI", 36f, FontStyle.Bold),
            ForeColor = Color.White,
            AutoSize = false,
            Size = new Size(500, 60),
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Color.Transparent
        };

        _subtitleLabel = new Label
        {
            Text = "Stock Management System",
            Font = new Font("Segoe UI", 14f, FontStyle.Regular),
            ForeColor = Color.FromArgb(148, 163, 184),
            AutoSize = false,
            Size = new Size(500, 30),
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Color.Transparent
        };

        _statusLabel = new Label
        {
            Text = "Starting server...",
            Font = new Font("Segoe UI", 11f, FontStyle.Regular),
            ForeColor = Color.FromArgb(100, 116, 139),
            AutoSize = false,
            Size = new Size(500, 25),
            TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Color.Transparent
        };

        _progressBar = new ProgressBar
        {
            Size = new Size(300, 4),
            Style = ProgressBarStyle.Marquee,
            MarqueeAnimationSpeed = 30,
            BackColor = Color.FromArgb(30, 41, 59),
            ForeColor = Color.FromArgb(59, 130, 246),
            Visible = true
        };

        var centerX = (ClientSize.Width) / 2;
        var centerY = ClientSize.Height / 2;

        logoLabel.Location = new Point(centerX - 250, centerY - 100);
        _subtitleLabel.Location = new Point(centerX - 250, centerY - 40);
        _progressBar.Location = new Point(centerX - 150, centerY + 30);
        _statusLabel.Location = new Point(centerX - 250, centerY + 50);

        _loadingPanel.Controls.AddRange([logoLabel, _subtitleLabel, _progressBar, _statusLabel]);

        _webView = new Microsoft.Web.WebView2.WinForms.WebView2
        {
            Dock = DockStyle.Fill,
            Visible = false
        };

        Controls.Add(_webView);
        Controls.Add(_loadingPanel);

        ResumeLayout(false);
    }

    private async void OnFormLoad(object? sender, EventArgs e)
    {
        StartApiProcess();
        await WaitForApiAsync();

        // Clear WebView2 cache on each startup to ensure fresh assets
        var webViewDataFolder = Path.Combine(AppContext.BaseDirectory, "WebView2Data");
        try
        {
            if (Directory.Exists(webViewDataFolder))
                Directory.Delete(webViewDataFolder, recursive: true);
        }
        catch { }

        _loadingPanel.Visible = false;
        _webView.Visible = true;

        var env = await CoreWebView2Environment.CreateAsync(null, webViewDataFolder);
        await _webView.EnsureCoreWebView2Async(env);
        _webView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;
        _webView.CoreWebView2.Navigate($"{_baseUrl}?v={DateTime.Now.Ticks}");
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.WebMessageAsJson;
            if (json.Contains("\"type\"") && json.Contains("\"print\""))
            {
                var html = ExtractJsonString(json, "html");
                if (!string.IsNullOrEmpty(html))
                {
                    PrintHtmlSilent(html);
                }
            }
        }
        catch { }
    }

    private static string ExtractJsonString(string json, string key)
    {
        var search = $"\"{key}\":\"";
        var start = json.IndexOf(search, StringComparison.Ordinal);
        if (start < 0) return string.Empty;
        start += search.Length;
        var end = json.IndexOf('"', start);
        if (end < 0) return string.Empty;
        var value = json[start..end];
        value = value.Replace("\\\"", "\"").Replace("\\n", "\n").Replace("\\r", "").Replace("\\\\", "\\");
        return value;
    }

    private void PrintHtmlSilent(string html)
    {
        try
        {
            var tempFile = Path.Combine(Path.GetTempPath(), $"flexshoes_receipt_{Guid.NewGuid():N}.html");
            File.WriteAllText(tempFile, html);

            // Open with default browser — user prints from there
            Process.Start(new ProcessStartInfo
            {
                FileName = tempFile,
                UseShellExecute = true
            });

            Task.Delay(5000).ContinueWith(_ =>
            {
                try { File.Delete(tempFile); } catch { }
            });
        }
        catch { }
    }

    private void StartApiProcess()
    {
        var apiExePath = Path.Combine(AppContext.BaseDirectory, "api", "FlexShoes Stock.exe");
        if (!File.Exists(apiExePath))
        {
            apiExePath = Path.Combine(AppContext.BaseDirectory, "api", "SMS.API.exe");
        }
        if (!File.Exists(apiExePath))
        {
            MessageBox.Show(
                "Cannot find the API server.\n\nExpected location:\n" + apiExePath,
                "FlexShoes Stock",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Application.Exit();
            return;
        }

        try
        {
            var apiDir = Path.GetDirectoryName(apiExePath)!;
            // The API only ever needs to talk to this machine's own WebView2 instance.
            // Binding to 0.0.0.0 exposed it - and every unauthenticated endpoint on it -
            // to the whole LAN. Opt into LAN access explicitly via FLEXSHOES_LAN_ACCESS=1
            // (e.g. for a shared back-office setup) rather than defaulting to it.
            var bindHost = Environment.GetEnvironmentVariable("FLEXSHOES_LAN_ACCESS") == "1"
                ? "0.0.0.0"
                : "127.0.0.1";
            var startInfo = new ProcessStartInfo
            {
                FileName = apiExePath,
                WorkingDirectory = apiDir,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                Arguments = $"--urls=http://{bindHost}:{_apiPort}"
            };

            _apiProcess = Process.Start(startInfo);
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Failed to start the API server:\n{ex.Message}",
                "FlexShoes Stock",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            Application.Exit();
        }
    }

    private async Task WaitForApiAsync()
    {
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
        var maxWait = TimeSpan.FromSeconds(60);
        var sw = Stopwatch.StartNew();

        while (sw.Elapsed < maxWait)
        {
            try
            {
                var resp = await http.GetAsync($"{_baseUrl}/api/health");
                if (resp.IsSuccessStatusCode) return;
            }
            catch { }

            await Task.Delay(500);
        }
    }

    private void OnFormClosing(object? sender, FormClosingEventArgs e)
    {
        try
        {
            if (_apiProcess != null && !_apiProcess.HasExited)
            {
                _apiProcess.Kill(entireProcessTree: true);
                _apiProcess.Dispose();
            }
        }
        catch { }

        _webView?.Dispose();
    }
}
