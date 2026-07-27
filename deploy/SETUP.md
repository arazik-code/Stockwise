# Stock Management System - Production Setup Guide

## System Requirements

### Hardware
- **PC**: Windows 10/11 (64-bit)
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 10GB free space
- **Printer**: TSC TTP-247 (USB or TCP/IP)
- **Scanner**: DataLogic 959 Terry (USB)

### Software
- **.NET 10 Runtime**: https://dotnet.microsoft.com/download/dotnet/10.0
- **PostgreSQL 16**: https://www.postgresql.org/download/windows/
- **Modern Browser**: Chrome, Edge, or Firefox

---

## Installation Steps

### Step 1: Install PostgreSQL

1. Download PostgreSQL 16 for Windows
2. Run the installer
3. Set password: `postgres` (or your preferred password)
4. Keep default port: `5432`
5. Complete installation

### Step 2: Install .NET 10

1. Download .NET 10 Runtime (not SDK)
2. Run the installer
3. Restart your computer

### Step 3: Configure the System

1. Copy `.env.example` to `.env`
2. Edit `.env` with your settings:
   ```
   DB_PASSWORD=your_postgres_password
   JWT_SECRET=your_random_secret_key
   STORE_NAME=Your Store Name
   PRINTER_IP=192.168.1.100
   ```

### Step 4: Build and Run

1. Open Command Prompt as Administrator
2. Navigate to the project folder
3. Run: `deploy\start.bat`

### Step 5: Access the System

Open your browser and go to:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:5000
- **Swagger**: http://localhost:5000/swagger

---

## Printer Configuration

### Option A: TCP/IP (Recommended)

If your TSC TTP-247 has an Ethernet port:

1. Connect printer to your network
2. Find its IP address (check printer menu or use LabelStar software)
3. Update `appsettings.json`:
   ```json
   "Printer": {
     "ConnectionType": "TCP",
     "IpAddress": "192.168.1.100",
     "Port": 9100
   }
   ```

### Option B: USB Direct

1. Connect printer via USB
2. Install TSC driver
3. Share the printer: Right-click > Properties > Sharing > Share this printer
4. Update `appsettings.json`:
   ```json
   "Printer": {
     "ConnectionType": "USB",
     "WindowsShareName": "TSC TTP-247"
   }
   ```

### Option C: USB via Windows Share

1. Connect printer via USB
2. Install TSC driver
3. Share as "TSC TTP-247"
4. The API will access via `\\localhost\TSC TTP-247`

---

## Scanner Configuration

The DataLogic 959 Terry is a HID keyboard emulator:

1. Connect via USB
2. Scan a barcode - it types the numbers like a keyboard
3. No driver needed
4. Works automatically with the POS page

---

## Database Management

### Connect to PostgreSQL

```powershell
# Using psql
psql -U postgres -h localhost -p 5432 StockManagement

# Using pgAdmin (GUI)
# Download from: https://www.pgadmin.org/
```

### Backup Database

```powershell
# Manual backup
pg_dump -U postgres StockManagement > backup.sql

# Or use the backup script
deploy\backup.bat
```

### Restore Database

```powershell
# Drop and recreate
psql -U postgres -c "DROP DATABASE IF EXISTS StockManagement;"
psql -U postgres -c "CREATE DATABASE StockManagement;"

# Restore from backup
psql -U postgres StockManagement < backup.sql
```

---

## Running as Windows Service

To start automatically with Windows:

1. Open Command Prompt as Administrator
2. Run: `deploy\install-service.bat`

The service will:
- Start automatically when Windows starts
- Restart automatically if it crashes
- Run in the background without a console window

To manage the service:
1. Open `services.msc`
2. Find "Stock Management API"
3. Right-click for options (Start/Stop/Restart)

---

## Troubleshooting

### "Port already in use"

```powershell
# Find what's using port 5000
netstat -ano | findstr :5000

# Kill the process
taskkill /PID <process_id> /F
```

### "Database connection failed"

1. Check PostgreSQL is running: `netstat -an | findstr :5432`
2. Verify password in `appsettings.json`
3. Check firewall isn't blocking port 5432

### "Printer not responding"

1. Verify printer is powered on
2. Check USB cable connection
3. Try printing a test page from Windows
4. For TCP: `ping 192.168.1.100`

### "JWT token expired"

The default token expires after 8 hours. To extend:
1. Edit `appsettings.json`
2. Change `ExpirationMinutes` to desired value

---

## Default Accounts

A fresh install seeds three accounts, each flagged to require a password change on first
login:

| Username | Default password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `cashier` | `cashier123` | Cashier |
| `stock_manager` | `stock123` | StockManager |

## Security Checklist

- [ ] Log in with each default account once and set a new password (enforced automatically)
- [ ] Change default PostgreSQL password
- [ ] Generate secure JWT secret
- [ ] Change store information
- [ ] Configure printer IP address
- [ ] Set up daily backups (`tools/backup-db.ps1` + `tools/register-backup-task.ps1`)
- [ ] Restrict API access (firewall) - the app binds to 127.0.0.1 by default; only set
      `FLEXSHOES_LAN_ACCESS=1` if you specifically need another machine to reach it
- [ ] Enable HTTPS (recommended for production)

---

## Performance Tips

1. **Database Indexes**: Already optimized in the application
2. **Connection Pooling**: PostgreSQL handles this automatically
3. **Caching**: API responses are not cached (real-time data)
4. **Log Level**: Set to "Warning" in production

---

## Support

For issues or questions:
- Check the logs in the console window
- Review `appsettings.json` configuration
- Verify PostgreSQL and printer connections
