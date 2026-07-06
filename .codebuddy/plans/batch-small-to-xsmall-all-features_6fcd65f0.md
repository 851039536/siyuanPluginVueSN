---
name: batch-small-to-xsmall-all-features
overview: 将所有 features 目录下 .vue 文件中的 size="small" 全局替换为 size="xsmall"（排除 src/components/ 和 src/features/s3Backup/）。
todos:
  - id: run-powershell-replace
    content: 执行 PowerShell 脚本，将 src/features/ 下所有 .vue 文件的 size="small" 替换为 size="xsmall"（排除 s3Backup）
    status: completed
  - id: verify-lint
    content: 运行 pnpm lint 验证无错误
    status: completed
    dependencies:
      - run-powershell-replace
---

## 需求

将 `src/features/` 下所有 .vue 文件中显式的 `size="small"` 全局替换为 `size="xsmall"`。

## 排除

- `src/components/` — 组件定义文件，size prop 默认值保持不变
- `src/features/s3Backup/` — 上一轮已完成替换

## 技术方案

使用 PowerShell 脚本批量替换，与 s3Backup 上一轮方案一致：遍历 `src/features/` 下所有 .vue 文件（排除 s3Backup），对每个文件执行字符串替换 `.Replace('size="small"', 'size="xsmall"')`。

## 实现细节

### 影响范围

约 84 个 .vue 文件，分布在以下功能模块中：

| 模块 | 文件数 | 出现次数 |
| --- | --- | --- |
| apiDebugger | 1 | 12 |
| wordQuery | 5 | 43 |
| aiContentGenerator | 4 | 28 |
| websiteNavigation | 5 | 11 |
| video | 4 | 23 |
| toolCollection/base64Image | 6 | 11 |
| toolCollection/unitConverter | 3 | 10 |
| htmlViewer | 4 | 25 |
| gitPush | 11 | 28 |
| flashcardReading | 8 | 20+ |
| passwordVault | 2 | 36 |
| prompts | 5 | 14 |
| shortcut | 4 | 12 |
| scriptLauncher | 3 | 14 |
| superPanel | 4 | 6 |
| imageCreation | 2 | 15 |
| imageCompressor | 1 | 8 |
| statistics | 1 | 1 |
| skillsViewer | 1 | 6 |
| pageLock | 1 | 1 |
| floatingToolbar | 2 | 9 |
| 其余散布 | ~10 | ~15 |


### 替换脚本（与 s3Backup 上一轮一致）

```
$utf8 = New-Object System.Text.UTF8Encoding $false
$files = Get-ChildItem -Path 'src/features' -Filter '*.vue' -Recurse | Where-Object { $_.FullName -notmatch 's3Backup' }
foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText($f.FullName, $utf8)
    if ($content.Contains('size="small"')) {
        $content = $content.Replace('size="small"', 'size="xsmall"')
        [System.IO.File]::WriteAllText($f.FullName, $content, $utf8)
    }
}
```

### 注意事项

- 使用 BOM-less UTF8 确保不做编码转换
- 排除路径含 `s3Backup` 的文件（已处理）
- 替换后运行 ESLint 验证