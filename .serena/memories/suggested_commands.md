# Development Commands

## Essential Commands

### Development Server
```powershell
npm run dev    # Start Vite dev server with HMR
```

### Build
```powershell
npm run build  # TypeScript compile + Vite production build
```

### Preview Production Build
```powershell
npm run preview  # Preview the production build locally
```

## Windows System Commands
```powershell
# Navigation
Set-Location path  # cd equivalent
Get-Location       # pwd equivalent
Get-ChildItem      # ls/dir equivalent

# File operations
Get-Content file   # cat equivalent
Select-String      # grep equivalent

# Git
git status
git add .
git commit -m "message"
git push
```

## Environment Setup
1. Copy `.env.local.example` to `.env.local`
2. Set required environment variables:
   - `VITE_GEMINI_API_KEY` or `VITE_API_KEYS` (comma-separated for rotation)
   - `VITE_EMAILJS_SERVICE_ID`
   - `VITE_EMAILJS_TEMPLATE_ID`
   - `VITE_EMAILJS_PUBLIC_KEY`

## Debugging
```powershell
# Enable verbose logging
$env:VITE_VERBOSE_LOGGING="true"
npm run dev
```
