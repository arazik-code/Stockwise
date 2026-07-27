# Stock Management System - Deployment

## Files Overview

| File | Purpose |
|------|---------|
| `start.bat` | First-time build and run |
| `run.bat` | Quick start (after first build) |
| `backup.bat` | Daily database backup |
| `install-service.bat` | Install as Windows Service |
| `help.bat` | Quick reference card |
| `.env.example` | Environment variables template |
| `appsettings.Production.json` | Production configuration |
| `SETUP.md` | Full setup guide |

## Quick Start

```powershell
# 1. First time setup
deploy\start.bat

# 2. Daily use
deploy\run.bat

# 3. Backup
deploy\backup.bat
```

## System Architecture

```
┌─────────────────┐
│   Browser       │  http://localhost:5173
│   (React SPA)   │
└────────┬────────┘
         │
         v
┌─────────────────┐
│   API Server    │  http://localhost:5000
│   (.NET 10)     │
└────────┬────────┘
         │
         v
┌─────────────────┐
│   PostgreSQL    │  localhost:5432
│   Database      │
└─────────────────┘
```

## Hardware Connections

```
┌─────────────────┐
│   USB Ports     │
│   ┌───────────┐ │
│   │ Scanner   │ │  DataLogic 959 Terry
│   │ (HID)     │ │  Auto-detected
│   └───────────┘ │
│   ┌───────────┐ │
│   │ Printer   │ │  TSC TTP-247
│   │ (USB/TCP) │ │  TCP recommended
│   └───────────┘ │
└─────────────────┘
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```ini
DB_PASSWORD=your_postgres_password
JWT_SECRET=your_random_secret_key
STORE_NAME=Your Store Name
PRINTER_IP=192.168.1.100
```

## Troubleshooting

### Port in use
```powershell
netstat -ano | findstr :5000
taskkill /PID <process_id> /F
```

### Database not connecting
```powershell
# Check PostgreSQL
netstat -an | findstr :5432

# Test connection
psql -U postgres -h localhost
```

### Printer not working
1. Check USB connection
2. Verify IP address (TCP mode)
3. Test from Windows: Print Test Page

## Support

See `SETUP.md` for detailed instructions.
