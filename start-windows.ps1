$ErrorActionPreference = 'Stop'
$Root = $PSScriptRoot
Set-Location -LiteralPath $Root

function Find-Python {
    $Candidates = @(
        (Join-Path $Root '.venv\Scripts\python.exe'),
        (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe')
    )
    foreach ($Candidate in $Candidates) {
        if (Test-Path -LiteralPath $Candidate) {
            try {
                & $Candidate -c 'import sys;sys.exit(0 if sys.version_info >= (3,12) else 1)' 2>$null
                if ($LASTEXITCODE -eq 0) { return $Candidate }
            } catch { }
        }
    }
    if (Get-Command py.exe -ErrorAction SilentlyContinue) {
        try {
        $Found = & py.exe -3 -c 'import sys;print(sys.executable if sys.version_info >= (3,12) else "")' 2>$null
        if ($LASTEXITCODE -eq 0 -and $Found -and (Test-Path -LiteralPath $Found)) { return $Found }
        } catch { }
    }
    $PythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
    if ($PythonCommand -and $PythonCommand.Source -notlike '*WindowsApps*') {
        try {
        $Found = & python.exe -c 'import sys;print(sys.executable if sys.version_info >= (3,12) else "")' 2>$null
        if ($LASTEXITCODE -eq 0 -and $Found -and (Test-Path -LiteralPath $Found)) { return $Found }
        } catch { }
    }
    return $null
}

$ApiProcess = $null
try {
    Write-Host 'POKER / OS - Private offline review' -ForegroundColor Green
    Write-Host 'Checking Python. First setup needs an Internet connection.'
    if (-not (Test-Path -LiteralPath (Join-Path $Root 'dist\index.html'))) {
        throw 'Web files missing. Please extract the entire ZIP first, then run Start-Poker-OS.cmd from the extracted folder.'
    }
    $Python = Find-Python
    if (-not $Python) {
        if (-not (Get-Command winget.exe -ErrorAction SilentlyContinue)) {
            Start-Process 'https://www.python.org/downloads/windows/'
            throw 'Python is needed. Install Python 3.12 or newer from the page opened, then double-click Start-Poker-OS.cmd again. No Node.js needed.'
        }
        Write-Host 'Installing official Python 3.12 with Windows Package Manager. This can take a few minutes.'
        & winget.exe install --id Python.Python.3.12 --exact --source winget --scope user --accept-package-agreements --accept-source-agreements --disable-interactivity
        if ($LASTEXITCODE -ne 0) { throw 'Python installation did not complete. Copy the message above and ask for help.' }
        $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
        $Python = Find-Python
        if (-not $Python) { throw 'Python was installed. Close this window and double-click Start-Poker-OS.cmd again.' }
    }
    $VenvPython = Join-Path $Root '.venv\Scripts\python.exe'
    if (-not (Test-Path -LiteralPath $VenvPython)) {
        Write-Host 'Preparing your private environment...'
        & $Python -m venv (Join-Path $Root '.venv')
        if ($LASTEXITCODE -ne 0) { throw 'Could not prepare Python environment. Extract to a folder you can write to, such as Documents\Poker-OS.' }
    }
    & $VenvPython -c 'import importlib.util,sys;sys.exit(0 if importlib.util.find_spec("pypdf") and __import__("pypdf").__version__=="6.12.0" else 1)' 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host 'Installing PDF reader for your study library...'
        & $VenvPython -m pip install -r (Join-Path $Root 'requirements.txt')
        if ($LASTEXITCODE -ne 0) { throw 'PDF reader installation failed. Check your Internet connection and try again.' }
    }
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
        if ($ApiProcess.HasExited) { throw 'Port 8765 may already be in use. Close the other app or restart Windows, then try again.' }
        try {
            $Health = Invoke-RestMethod -Uri ($Url + '/api/health') -TimeoutSec 1
            if ($Health.mode -eq 'offline-review') { $Ready = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 300
    }
    if (-not $Ready) { throw 'Poker OS did not finish starting. Please send the message above for help.' }
    Start-Process $Url
    Write-Host ''
    Write-Host 'READY - Your browser should open automatically.' -ForegroundColor Green
    Write-Host 'Keep this window open while using Poker OS. Press Ctrl+C here to stop.'
    Write-Host 'Your private hands and study index are saved in the data folder.'
    $ApiProcess.WaitForExit()
} catch {
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($ApiProcess -and -not $ApiProcess.HasExited) { Stop-Process -Id $ApiProcess.Id -ErrorAction SilentlyContinue }
}
