# ==============================================================================
# CCE-PGPA Production Roster & Staff Provisioning Script
# ==============================================================================
$ErrorActionPreference = "Stop"

Write-Host "=== CCE-PGPA Production Provisioning Tool ===" -ForegroundColor Cyan
Write-Host "This script provisions the Admin, HOD, 3 Mentors, and 61 Students on Render.`n"

# 1. Resolve setup secret securely:
# Priority 1: Environment variable $env:SETUP_TOKEN
# Priority 2: Windows Clipboard via Get-Clipboard (if copied from Render dashboard)
# Priority 3: Interactive prompt (fallback)
$rawSecret = $null
if (-not [string]::IsNullOrWhiteSpace($env:SETUP_TOKEN)) {
    Write-Host "[Auth] Using setup token from environment variable." -ForegroundColor Cyan
    $rawSecret = $env:SETUP_TOKEN
} else {
    try {
        $clip = (Get-Clipboard -Raw -ErrorAction SilentlyContinue)
        if (-not [string]::IsNullOrWhiteSpace($clip) -and $clip.Trim().Length -ge 16) {
            Write-Host "[Auth] Detected setup token from Windows clipboard (non-echoed, secure)." -ForegroundColor Cyan
            $rawSecret = $clip
        }
    } catch {
        # Clipboard access not available in current session
    }
}

if ([string]::IsNullOrWhiteSpace($rawSecret)) {
    $rawSecret = Read-Host "Enter Render JWT_SECRET_KEY (or copy to clipboard and re-run)"
}

# Clean any control characters (e.g. ^V / 0x16 from terminal paste), newlines, or whitespace without logging secrets
$setupSecret = [regex]::Replace($rawSecret, "[\x00-\x1F\x7F\s]", "")

if ([string]::IsNullOrWhiteSpace($setupSecret)) {
    Write-Error "Error: JWT_SECRET_KEY cannot be empty."
    exit 1
}

# 2. Locate CSV files
$baseDir = $PSScriptRoot
$studentPath = Join-Path $baseDir "backend/data/import/students_roster.csv"
$staffPath   = Join-Path $baseDir "backend/data/import/staff_roster.csv"

if (-not (Test-Path $studentPath)) {
    # Fallback to local data dir if run from backend
    $studentPath = Join-Path $baseDir "data/import/students_roster.csv"
    $staffPath   = Join-Path $baseDir "data/import/staff_roster.csv"
}

if (-not (Test-Path $studentPath)) { Write-Error "Student roster CSV not found at $studentPath"; exit 1 }
if (-not (Test-Path $staffPath))   { Write-Error "Staff roster CSV not found at $staffPath"; exit 1 }

Write-Host "[1/3] Reading roster files..." -ForegroundColor Yellow
$studentCsvText = [System.IO.File]::ReadAllText((Resolve-Path $studentPath).Path, [System.Text.Encoding]::UTF8)
$staffCsvText   = [System.IO.File]::ReadAllText((Resolve-Path $staffPath).Path,   [System.Text.Encoding]::UTF8)

# 3. Construct JSON payload strictly matching deployed schema
Write-Host "[2/3] Preparing API payload..." -ForegroundColor Yellow
$bodyObject = [ordered]@{
    csv_content       = $studentCsvText
    staff_csv_content = $staffCsvText
    provision_admin   = $true
    initial_password  = $null
}

$jsonBody = $bodyObject | ConvertTo-Json -Compress

# 4. Invoke the live Render endpoint
Write-Host "[3/3] Sending provisioning request to Render..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod `
        -Uri "https://cce-pgpa.onrender.com/api/v1/admin/roster/bootstrap" `
        -Method Post `
        -Headers @{
            "Content-Type"  = "application/json"
            "X-Setup-Token" = $setupSecret.Trim()
        } `
        -Body $jsonBody

    Write-Host "`n[SUCCESS] Production Provisioning Completed Successfully!" -ForegroundColor Green
    $response | Format-List
} catch {
    Write-Host "`n[FAILED] Request Failed:" -ForegroundColor Red
    if ($_.Exception.Response) {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        Write-Host "HTTP Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
        Write-Host "Server Detail: $errBody" -ForegroundColor Red
    } else {
        Write-Host "$($_.Exception.Message)" -ForegroundColor Red
    }
    exit 1
}
