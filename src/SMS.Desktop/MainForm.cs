using System.Diagnostics;
using System.Net.Http;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace SMS.Desktop;

public class DesktopConfig
{
    // Null/empty = no VPS configured yet - the app behaves exactly as it always has (local only,
    // no health-check timer, no banner). Set once the VPS is up; see deploy/VPS-DEPLOY.md.
    public string? RemoteApiUrl { get; set; }
}

public partial class MainForm : Form
{
    private enum Brain { Local, Remote }

    private Process? _apiProcess;
    private readonly int _apiPort = 5001;
    private readonly string _localUrl;
    private string? _remoteUrl;
    private Brain _currentBrain = Brain.Local;
    private int _consecutiveFailures;
    private System.Windows.Forms.Timer? _healthCheckTimer;
    private readonly HttpClient _healthHttpClient = new() { Timeout = TimeSpan.FromSeconds(3) };

    // A blip shouldn't bounce the app between brains - require this many consecutive failed
    // checks (roughly one per HealthCheckIntervalMs) before actually failing over.
    private const int FailureThreshold = 3;
    private const int HealthCheckIntervalMs = 20_000;

    private Panel _loadingPanel = null!;
    private Label _statusLabel = null!;
    private Label _subtitleLabel = null!;
    private ProgressBar _progressBar = null!;
    private Microsoft.Web.WebView2.WinForms.WebView2 _webView = null!;

    private Panel _bannerPanel = null!;
    private Label _bannerLabel = null!;
    private Button _bannerButton = null!;

    public MainForm()
    {
        _localUrl = $"http://localhost:{_apiPort}";
        _remoteUrl = LoadDesktopConfig().RemoteApiUrl;
        if (string.IsNullOrWhiteSpace(_remoteUrl)) _remoteUrl = null;

        InitializeUI();
        Load += OnFormLoad;
        FormClosing += OnFormClosing;
    }

    private static DesktopConfig LoadDesktopConfig()
    {
        try
        {
            var path = Path.Combine(AppContext.BaseDirectory, "desktop-config.json");
            if (!File.Exists(path)) return new DesktopConfig();
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<DesktopConfig>(json) ?? new DesktopConfig();
        }
        catch
        {
            // Missing/malformed config is not fatal - just means "no remote configured", same as
            // not having the file at all.
            return new DesktopConfig();
        }
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

        // Thin status bar for the VPS/local-fallback connectivity state. Dock=Top, hidden by
        // default (zero height in the layout when not Visible) - only shown once a RemoteApiUrl
        // is actually configured and something's worth telling the cashier about. Added to the
        // Controls collection AFTER the Fill-docked webview so it correctly reserves its slice at
        // the top and the webview fills the remainder (WinForms docks later-added siblings first).
        _bannerPanel = new Panel
        {
            Dock = DockStyle.Top,
            Height = 36,
            Visible = false,
            BackColor = Color.FromArgb(180, 83, 9) // amber-700, overwritten per-state below
        };
        _bannerLabel = new Label
        {
            Dock = DockStyle.Left,
            AutoSize = false,
            Width = 900,
            TextAlign = ContentAlignment.MiddleLeft,
            Padding = new Padding(12, 0, 0, 0),
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
            ForeColor = Color.White,
            BackColor = Color.Transparent
        };
        _bannerButton = new Button
        {
            Dock = DockStyle.Right,
            Width = 160,
            Text = "Recharger",
            Visible = false,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(255, 255, 255, 40),
            ForeColor = Color.White
        };
        _bannerButton.FlatAppearance.BorderSize = 0;
        _bannerButton.Click += (_, _) => SwitchToRemote(userInitiated: true);
        _bannerPanel.Controls.Add(_bannerLabel);
        _bannerPanel.Controls.Add(_bannerButton);

        Controls.Add(_webView);
        Controls.Add(_loadingPanel);
        Controls.Add(_bannerPanel);

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

        if (_remoteUrl is not null)
        {
            // One quick check to decide the INITIAL brain - not the full 60s retry loop
            // WaitForApiAsync uses for the local API, since we don't want a slow/unreachable VPS
            // to hold up app startup for a cashier who just needs to ring up a sale.
            var remoteHealthyAtStartup = await IsHealthyAsync(_remoteUrl);
            _currentBrain = remoteHealthyAtStartup ? Brain.Remote : Brain.Local;

            _healthCheckTimer = new System.Windows.Forms.Timer { Interval = HealthCheckIntervalMs };
            _healthCheckTimer.Tick += async (_, _) => await HealthCheckTick();
            _healthCheckTimer.Start();
        }
        else
        {
            _currentBrain = Brain.Local;
        }

        var targetUrl = _currentBrain == Brain.Remote ? _remoteUrl! : _localUrl;
        _webView.CoreWebView2.Navigate($"{targetUrl}?v={DateTime.Now.Ticks}");
    }

    private async Task HealthCheckTick()
    {
        if (_remoteUrl is null) return;

        var remoteHealthy = await IsHealthyAsync(_remoteUrl);

        if (_currentBrain == Brain.Remote)
        {
            if (remoteHealthy)
            {
                _consecutiveFailures = 0;
                return;
            }

            _consecutiveFailures++;
            if (_consecutiveFailures >= FailureThreshold)
            {
                SwitchToLocal();
            }
        }
        else // currently on the local fallback
        {
            if (remoteHealthy)
            {
                ShowReconnectBanner();
            }
            else
            {
                HideBanner();
            }
        }
    }

    // Automatic - a blip in the primary connection shouldn't need the cashier to do anything.
    private void SwitchToLocal()
    {
        _currentBrain = Brain.Local;
        _consecutiveFailures = 0;
        ShowOfflineBanner();
        _webView.CoreWebView2.Navigate($"{_localUrl}?v={DateTime.Now.Ticks}");
    }

    // User-initiated only (the banner's "Recharger" button) - never automatic, so a cashier
    // mid-transaction is never surprised by a reload they didn't ask for. The cart survives the
    // reload either way (persisted client-side), but choosing the moment is still nicer.
    private void SwitchToRemote(bool userInitiated)
    {
        if (!userInitiated) return;
        _currentBrain = Brain.Remote;
        _consecutiveFailures = 0;
        HideBanner();
        _webView.CoreWebView2.Navigate($"{_remoteUrl}?v={DateTime.Now.Ticks}");
    }

    private void ShowOfflineBanner()
    {
        _bannerPanel.BackColor = Color.FromArgb(180, 83, 9); // amber-700
        _bannerLabel.Text = "Mode hors-ligne - connexion au serveur principal indisponible. Fonctionnement en local.";
        _bannerButton.Visible = false;
        _bannerPanel.Visible = true;
    }

    private void ShowReconnectBanner()
    {
        _bannerPanel.BackColor = Color.FromArgb(21, 128, 61); // emerald-700
        _bannerLabel.Text = "Connexion au serveur principal rétablie.";
        _bannerButton.Visible = true;
        _bannerPanel.Visible = true;
    }

    private void HideBanner()
    {
        _bannerPanel.Visible = false;
    }

    private async Task<bool> IsHealthyAsync(string baseUrl)
    {
        try
        {
            var resp = await _healthHttpClient.GetAsync($"{baseUrl}/api/health");
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.WebMessageAsJson;
            if (json.Contains("\"type\"") && json.Contains("\"print\""))
            {
                var html = ExtractJsonString(json, "html");
                if (!string.IsNullOrEmpty(html))
                {
                    await PrintHtmlSilentAsync(html);
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

    // Was: write the HTML to a temp file and open it with the OS default browser, with a comment
    // saying "user prints from there". That's not silent printing at all - it pops a whole separate
    // browser window and needs a manual click, which on a busy POS counter reads as "the printer
    // doesn't work". This uses a second, invisible WebView2 instance and WebView2's own
    // PrintToDefaultPrinterAsync, which sends straight to the OS default printer with no dialog.
    private async Task PrintHtmlSilentAsync(string html)
    {
        Microsoft.Web.WebView2.WinForms.WebView2? printView = null;
        try
        {
            printView = new Microsoft.Web.WebView2.WinForms.WebView2
            {
                Size = new Size(1, 1),
                Location = new Point(-2000, -2000),
                Visible = false
            };
            Controls.Add(printView);

            await printView.EnsureCoreWebView2Async(_webView.CoreWebView2.Environment);

            var navigated = new TaskCompletionSource();
            printView.CoreWebView2.NavigationCompleted += (_, _) => navigated.TrySetResult();
            printView.CoreWebView2.NavigateToString(html);

            var completed = await Task.WhenAny(navigated.Task, Task.Delay(TimeSpan.FromSeconds(10)));
            if (completed != navigated.Task) return; // navigation never settled - bail out rather than print a blank page

            var settings = printView.CoreWebView2.Environment.CreatePrintSettings();
            settings.ShouldPrintBackgrounds = true;
            settings.MarginTop = 0;
            settings.MarginBottom = 0;
            settings.MarginLeft = 0;
            settings.MarginRight = 0;

            // Empty PrinterName means "the OS default printer" - no dialog, no user interaction.
            // Bounded the same way as the navigation above: an offline printer or a stuck driver
            // can leave PrintAsync's returned task never completing, and unlike a timed-out
            // navigation there is no later retry to notice - the receipt would just silently
            // never print, with nothing in the UI ever telling the cashier why. Racing it against
            // a timeout guarantees this method always returns and reaches the finally block below,
            // so the hidden WebView2 instance is always disposed rather than left running forever.
            var printTask = printView.CoreWebView2.PrintAsync(settings);
            await Task.WhenAny(printTask, Task.Delay(TimeSpan.FromSeconds(15)));
        }
        catch
        {
            // Printer offline/misconfigured - nothing sensible to surface from a WebMessage handler.
            // The user already sees the sale/document complete either way; printing is best-effort.
        }
        finally
        {
            if (printView is not null)
            {
                Controls.Remove(printView);
                printView.Dispose();
            }
        }
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
                var resp = await http.GetAsync($"{_localUrl}/api/health");
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
            _healthCheckTimer?.Stop();
            _healthCheckTimer?.Dispose();
            _healthHttpClient.Dispose();

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
