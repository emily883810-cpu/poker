$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
$Bootstrap = Join-Path $Root 'windows_bootstrap.py'
Set-Location -LiteralPath $Root

function Find-Python {
    $Candidates = @(
        (Join-Path $Root '.venv\Scripts\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe')
    )
    foreach ($Candidate in $Candidates) {
        if (Test-Path -LiteralPath $Candidate) {
            try {
                $Found = & $Candidate $Bootstrap --python-path 2>$null
                if ($LASTEXITCODE -eq 0 -and $Found -and (Test-Path -LiteralPath $Found)) { return $Found }
            } catch { }
        }
    }
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        try {
            $Found = & py.exe -3 $Bootstrap --python-path 2>$null
            if ($LASTEXITCODE -eq 0 -and $Found -and (Test-Path -LiteralPath $Found)) { return $Found }
        } catch { }
    }
    $PythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($PythonCommand -and $PythonCommand.Source -notlike '*WindowsApps*') {
        try {
            $Found = & python.exe $Bootstrap --python-path 2>$null
            if ($LASTEXITCODE -eq 0 -and $Found -and (Test-Path -LiteralPath $Found)) { return $Found }
        } catch { }
    }
    return $null
}

function Test-Dependencies([string] $PythonPath) {
    $PreviousPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        & $PythonPath $Bootstrap --dependencies 2>$null
        return ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $PreviousPreference
    }
}

function Invoke-SetupCommand([string] $Program, [string[]] $Parameters) {
    $PreviousPreference = $ErrorActionPreference
    try {
        # Windows PowerShell 5.1 can turn native stderr into terminating errors.
        # Preserve the program's exit code; stderr warnings alone are not failure.
        $ErrorActionPreference = 'Continue'
        & $Program @Parameters 2>&1 | ForEach-Object { Write-Host $_ }
        $ExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $PreviousPreference
    }
    if ($ExitCode -ne 0) { throw ('Setup command failed with exit code ' + $ExitCode + '. See output above.') }
}

$ApiProcess = $null
$Stage = 'startup'
try {
    Write-Host 'POKER / OS - Windows launcher v0.1.1' -ForegroundColor Green
    Write-Host 'Checking Python. First setup needs an Internet connection.'
    if (-not (Test-Path -LiteralPath (Join-Path $Root 'dist\index.html')) -or -not (Test-Path -LiteralPath $Bootstrap)) {
        throw 'Files missing. Extract the entire ZIP first, then run Start-Poker-OS.cmd from the extracted folder.'
    }
    $Stage = 'Python discovery'
    $Python = Find-Python
    if (-not $Python) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            Start-Process 'https://www.python.org/downloads/windows/'
            throw 'Python is needed. Install Python 3.12 or newer from the page opened, then double-click Start-Poker-OS.cmd again. No Node.js needed.'
        }
        $Stage = 'Python installation'
        Write-Host 'Installing official Python 3.12. This can take a few minutes.'
        Invoke-SetupCommand 'winget.exe' @('install','--id','Python.Python.3.12','--exact','--source','winget','--scope','user','--accept-package-agreements','--accept-source-agreements','--disable-interactivity')
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        $Python = Find-Python
        if (-not $Python) { throw 'Python was installed. Close this window and double-click Start-Poker-OS.cmd again.' }
    }
    $Stage = 'private environment setup'
    $VenvPython = Join-Path $Root '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $VenvPython)) {
        Write-Host 'Preparing your private environment...'
        Invoke-SetupCommand $Python @('-m','venv',(Join-Path $Root '.venv'))
    }
    $Stage = 'PDF dependency check'
    if (-not (Test-Dependencies $VenvPython)) {
        $Stage = 'PDF reader installation'
        Write-Host 'Installing PDF reader for your study library...'
        Invoke-SetupCommand $VenvPython @('-m','pip','install','-r',(Join-Path $Root 'requirements.txt'))
        if (-not (Test-Dependencies $VenvPython)) { throw 'PDF reader verification failed after installation.' }
    }
    $Stage = 'local server startup'
    $Url = 'http://127.0.0.1:8765'
    $Existing = $null
    try { $Existing = Invoke-RestMethod -Uri ($Url + '/api/health') -TimeoutSec 2 } catch { }
    if ($Existing -and $Existing.mode -eq 'offline-review') {
        Write-Host 'Poker OS is already running. Opening your browser...'
        Start-Process $Url
        exit 0
    }
    $env:POKER_PORT = '8765'
    $ApiProcess = Start-Process -FilePath $VenvPython -ArgumentList '-m','server.app' -WorkingDirectory $Root -NoNewWindow -PassThru
    $Ready = $false
    for ($Attempt = 0; $Attempt -lt 30; $Attempt++) {
        if ($ApiProcess.HasExited) { throw 'Port 8765 may already be in use. Close the other app and try again.' }
        try {
            $Health = Invoke-RestMethod -Uri ($Url + '/api/health') -TimeoutSec 1
            if ($Health.mode -eq 'offline-review') { $Ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    if (-not $Ready) { throw 'Poker OS did not finish starting. Please send the message above for help.' }
    $Stage = 'browser opening'
    Start-Process $Url
    Write-Host ''
    Write-Host 'READY - Your browser should open automatically.' -ForegroundColor Green
    Write-Host 'Keep this window open while using Poker OS. Press Ctrl+C here to stop.'
    Write-Host 'Your private hands and study index are saved in the data folder.'
    $ApiProcess.WaitForExit()
} catch {
    Write-Host ('ERROR during ' + $Stage + ': ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host ('Location: ' + $_.InvocationInfo.PositionMessage)
    exit 1
} finally {
    if ($ApiProcess -and -not $ApiProcess.HasExited) { Stop-Process -Id $ApiProcess.Id -ErrorAction SilentlyContinue }
}
