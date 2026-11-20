# Local preview for the GitHub Pages site (docs/). No Node or Python required.
# Usage: powershell -ExecutionPolicy Bypass -File scripts\preview-docs.ps1 [-Port 8080]
# Images are copied from public/ into docs/ only during deployment, so any file
# missing from docs/ is served from public/ instead.
# (This file is intentionally ASCII-only so Windows PowerShell 5.1 parses it.)
param([int]$Port = 8080)

$root = Split-Path -Parent $PSScriptRoot
$docs = Join-Path $root "docs"
$public = Join-Path $root "public"
$types = @{
  ".html" = "text/html; charset=utf-8"; ".css" = "text/css; charset=utf-8";
  ".js" = "text/javascript; charset=utf-8"; ".png" = "image/png";
  ".svg" = "image/svg+xml"; ".json" = "application/json"; ".ico" = "image/x-icon"
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Preview: http://localhost:$Port/   (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
    if ($path -eq "" -or $path.EndsWith("/")) { $path += "index.html" }
    $file = $null
    foreach ($base in @($docs, $public)) {
      $candidate = [IO.Path]::GetFullPath((Join-Path $base $path))
      if ($candidate.StartsWith($base) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { $file = $candidate; break }
    }
    if ($file) {
      $bytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" })
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $ctx.Response.StatusCode = 404
    }
    $ctx.Response.Close()
  }
} finally {
  $listener.Stop()
}
