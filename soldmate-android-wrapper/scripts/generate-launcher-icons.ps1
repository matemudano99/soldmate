Add-Type -AssemblyName System.Drawing
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$src = Join-Path $repoRoot "soldmate-frontend\apps\next\public\logo.png"
$base = Join-Path $repoRoot "soldmate-android-wrapper\app\src\main\res"
$sizes = @{
  "mipmap-mdpi"    = 48
  "mipmap-hdpi"    = 72
  "mipmap-xhdpi"   = 96
  "mipmap-xxhdpi"  = 144
  "mipmap-xxxhdpi" = 192
}
$img = [System.Drawing.Image]::FromFile($src)
foreach ($folder in $sizes.Keys) {
  $size = $sizes[$folder]
  $dir = Join-Path $base $folder
  if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::FromArgb(255, 255, 255, 255))
  $g.DrawImage($img, 0, 0, $size, $size)
  $out = Join-Path $dir "ic_launcher.png"
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  Write-Host "Wrote $out ($size)"
}
$img.Dispose()
Write-Host "Done"
