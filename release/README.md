# 发布文件

Windows 安装包和免安装 ZIP 通过 GitHub Releases 发布，避免把约 80 MB 的二进制文件写入 Git 历史。

下载地址：<https://github.com/DpGhostCat/-/releases/latest>

发布时应包含：

- `Xunye-Windows-Setup.exe`
- `Xunye-Windows-x64.zip`
- `SHA256SUMS.txt`

本地构建命令：

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-windows-release.ps1
```
