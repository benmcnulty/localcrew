param(
  [string]$HostUrl = "http://127.0.0.1:11434",
  [string]$Model = "",
  [string]$OutputDir = ".",
  [switch]$Apply
)

$ErrorActionPreference = "Stop"

function Get-PreferredModel {
  param([object]$Tags)

  $models = @($Tags.models | ForEach-Object { $_.name }) | Where-Object {
    $_ -and $_ -notmatch "embed"
  }

  $preferences = @(
    "gpt-oss",
    "qwen3-coder",
    "llama3.1",
    "llama3.2",
    "qwen",
    "gemma"
  )

  foreach ($preference in $preferences) {
    $match = $models | Where-Object { $_ -like "*$preference*" } | Select-Object -First 1
    if ($match) {
      return $match
    }
  }

  return $models | Select-Object -First 1
}

function Get-ContextCandidates {
  param([double]$MemoryGb)

  if ($MemoryGb -ge 48) { return @(8192, 16384, 32768, 65536, 131072) }
  if ($MemoryGb -ge 24) { return @(8192, 16384, 32768, 65536) }
  if ($MemoryGb -ge 12) { return @(4096, 8192, 16384, 32768) }
  return @(4096, 8192, 16384)
}

function Invoke-OllamaBenchmark {
  param(
    [string]$BaseUrl,
    [string]$TargetModel,
    [int[]]$Candidates
  )

  $prompt = "Summarize how this node should contribute to a distributed Ollama swarm in five short bullets. Focus on delegation, queueing, memory, and documentation hygiene."
  $results = @()

  foreach ($candidate in $Candidates) {
    $body = @{
      model = $TargetModel
      prompt = $prompt
      stream = $false
      options = @{
        num_ctx = $candidate
        num_predict = 64
        temperature = 0
      }
    } | ConvertTo-Json -Depth 6

    $elapsed = Measure-Command {
      try {
        $null = Invoke-RestMethod -Uri "$($BaseUrl.TrimEnd('/'))/api/generate" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 180
        $script:lastBenchmarkOk = $true
      } catch {
        $script:lastBenchmarkOk = $false
        $script:lastBenchmarkError = $_.Exception.Message
      }
    }

    if ($lastBenchmarkOk) {
      $results += [pscustomobject]@{
        num_ctx    = $candidate
        ok         = $true
        elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 1)
      }
    } else {
      $results += [pscustomobject]@{
        num_ctx    = $candidate
        ok         = $false
        elapsed_ms = [math]::Round($elapsed.TotalMilliseconds, 1)
        error      = $lastBenchmarkError
      }
    }
  }

  return $results
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$tags = Invoke-RestMethod -Uri "$($HostUrl.TrimEnd('/'))/api/tags" -Method Get -TimeoutSec 30
if (-not $Model) {
  $Model = Get-PreferredModel -Tags $tags
}

if (-not $Model) {
  throw "No benchmarkable local models were found."
}

$memoryGb = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 1)
$cpu = (Get-CimInstance Win32_Processor | Select-Object -First 1).Name
$gpu = (Get-CimInstance Win32_VideoController | Select-Object -First 1).Name
$contexts = Get-ContextCandidates -MemoryGb $memoryGb
$results = Invoke-OllamaBenchmark -BaseUrl $HostUrl -TargetModel $Model -Candidates $contexts

$successful = @($results | Where-Object { $_.ok })
if ($successful.Count -eq 0) {
  throw "No successful benchmark runs were recorded."
}

$baseline = $successful[0].elapsed_ms
$recommended = $successful[0]
foreach ($entry in $successful) {
  if ($entry.elapsed_ms -le ($baseline * 4)) {
    $recommended = $entry
  }
}

$recommendedContext = [int]$recommended.num_ctx

if ($memoryGb -ge 24 -and $recommendedContext -ge 32768) {
  $tier = "top"
} elseif ($memoryGb -ge 12 -and $recommendedContext -ge 16384) {
  $tier = "mid"
} else {
  $tier = "low"
}

$recommendedEnv = [ordered]@{
  OLLAMA_CONTEXT_LENGTH   = "$recommendedContext"
  OLLAMA_FLASH_ATTENTION  = "1"
  OLLAMA_NUM_PARALLEL     = $(if ($tier -eq "top") { "2" } else { "1" })
  OLLAMA_MAX_LOADED_MODELS = $(if ($tier -eq "top") { "2" } else { "1" })
  OLLAMA_MAX_QUEUE        = $(if ($tier -eq "top") { "256" } elseif ($tier -eq "mid") { "128" } else { "64" })
  OLLAMA_KEEP_ALIVE       = $(if ($tier -eq "top") { "30m" } elseif ($tier -eq "mid") { "15m" } else { "10m" })
}

$profile = [ordered]@{
  platform                   = "windows"
  model                      = $Model
  tier                       = $tier
  memory_gb                  = $memoryGb
  cpu                        = $cpu
  gpu                        = $gpu
  benchmark_results          = $results
  recommended_context_length = $recommendedContext
  recommended_env            = $recommendedEnv
}

$profilePath = Join-Path $OutputDir "ollama-profile-$($env:COMPUTERNAME).json"
$profile | ConvertTo-Json -Depth 8 | Set-Content -Path $profilePath -Encoding UTF8

Write-Host ""
Write-Host "Saved profile: $profilePath"
Write-Host ""
Get-Content $profilePath
Write-Host ""
Write-Host "Recommended commands:"
foreach ($pair in $recommendedEnv.GetEnumerator()) {
  Write-Host "setx $($pair.Key) $($pair.Value)"
}
Write-Host "Restart Ollama after applying the values."

if ($Apply) {
  Write-Host ""
  Write-Host "Applying recommended environment variables with setx..."
  foreach ($pair in $recommendedEnv.GetEnumerator()) {
    setx $pair.Key $pair.Value | Out-Null
    Set-Item -Path "Env:$($pair.Key)" -Value $pair.Value
  }
  Write-Host "Applied. Restart Ollama for the new values to take effect."
}
