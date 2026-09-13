$ErrorActionPreference = 'Stop'
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'NeoPet AI\runtime\whisper'
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

Write-Output '[1/4] Installing Ollama'
winget install --id Ollama.Ollama --exact --silent --accept-package-agreements --accept-source-agreements
Write-Output '[2/4] Installing pyttsx3'
python -m pip install pyttsx3

Write-Output '[3/4] Installing Whisper Tiny'
$whisperExe = Join-Path $runtimeRoot 'Release\whisper-cli.exe'
if (-not (Test-Path -LiteralPath $whisperExe)) {
  $archive = Join-Path $runtimeRoot 'whisper-bin-x64.zip'
  Invoke-WebRequest 'https://github.com/ggml-org/whisper.cpp/releases/download/b4938/whisper-bin-x64.zip' -OutFile $archive
  Expand-Archive -LiteralPath $archive -DestinationPath $runtimeRoot -Force
  Remove-Item -LiteralPath $archive
}
$modelPath = Join-Path $runtimeRoot 'ggml-tiny.bin'
if (-not (Test-Path -LiteralPath $modelPath)) {
  Invoke-WebRequest 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin' -OutFile $modelPath
}

Write-Output '[4/4] Downloading Gemma 3 1B'
$env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
$ollamaCandidates = @(
  (Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'),
  (Join-Path $env:LOCALAPPDATA 'Microsoft\WindowsApps\ollama.exe'),
  'C:\Program Files\Ollama\ollama.exe'
)
$ollama = $ollamaCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $ollama) { $ollama = (Get-Command ollama -ErrorAction Stop).Source }
& $ollama pull gemma3:1b
Write-Output 'NeoPet local runtime installed.'
