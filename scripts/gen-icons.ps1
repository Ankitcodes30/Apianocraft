Add-Type -AssemblyName System.Drawing

$base = Join-Path (Get-Location) "public\icons"
New-Item -ItemType Directory -Force -Path $base | Out-Null

function New-ApianoIcon {
  param(
    [int]$Size,
    [string]$Path,
    [switch]$Maskable
  )

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 14, 17, 22))

  if ($Maskable) {
    $margin = [int]($Size * 0.12)
  } else {
    $margin = [int]($Size * 0.2)
  }

  $white = [System.Drawing.Color]::FromArgb(255, 244, 243, 240)
  $black = [System.Drawing.Color]::FromArgb(255, 27, 32, 39)
  $bg = [System.Drawing.Color]::FromArgb(255, 14, 17, 22)

  $keyTop = $Size * 0.55
  $keyBottom = $Size - $margin
  $whiteW = ($Size - 2 * $margin) / 5
  $keyH = $keyBottom - $keyTop

  $wb = New-Object System.Drawing.SolidBrush($white)
  $bb = New-Object System.Drawing.SolidBrush($black)
  $sb = New-Object System.Drawing.SolidBrush($bg)

  $rect = New-Object System.Drawing.RectangleF($margin, $keyTop, ($Size - 2 * $margin), $keyH)
  $g.FillRectangle($wb, $rect)

  for ($i = 1; $i -lt 5; $i++) {
    $x = $margin + $i * $whiteW
    $g.FillRectangle($sb, ($x - 1), $keyTop, 2, $keyH)
  }

  for ($i = 0; $i -lt 4; $i++) {
    $x = $margin + ($i + 1) * $whiteW - $whiteW * 0.28
    $bw = $whiteW * 0.55
    $bh = $keyH * 0.58
    $g.FillRectangle($bb, $x, $keyTop, $bw, $bh)
  }

  $wb.Dispose(); $bb.Dispose(); $sb.Dispose()
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-ApianoIcon -Size 192 -Path (Join-Path $base "icon-192.png")
New-ApianoIcon -Size 512 -Path (Join-Path $base "icon-512.png")
New-ApianoIcon -Size 512 -Path (Join-Path $base "icon-512-maskable.png") -Maskable
Write-Output "Icons written to $base"
