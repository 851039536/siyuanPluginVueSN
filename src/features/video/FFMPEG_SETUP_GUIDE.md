# FFmpeg 安装和设置指南

## 1. 下载 FFmpeg

### Windows
访问 FFmpeg 官方下载页面：
- https://ffmpeg.org/download.html
- 或使用推荐的构建版本：https://www.gyan.dev/ffmpeg/builds/

**推荐下载**：
- `ffmpeg-git-full.7z` 或 `ffmpeg-git-full.zip`
- 解压到本地目录，例如：`E:\Program\ffmpeg-8.0.1-essentials_build`

### macOS
```bash
brew install ffmpeg
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install ffmpeg
```

## 2. Windows 设置步骤

### 方法一：添加到系统 PATH（推荐）

1. **找到 FFmpeg 的 bin 目录**
   - 例如：`E:\Program\ffmpeg-8.0.1-essentials_build\bin`

2. **添加到系统环境变量**
   ```
   右键"此电脑" → 属性 → 高级系统设置 → 环境变量
   → 系统变量 → Path → 编辑 → 新建
   → 添加：E:\Program\ffmpeg-8.0.1-essentials_build\bin
   ```

3. **验证安装**
   ```bash
   # 重新打开 CMD 或 PowerShell
   ffmpeg -version
   ```
   应该显示版本信息。

4. **重启思源笔记**
   - 关闭并重新打开思源笔记
   - FFmpeg 功能应该可以正常使用

### 方法二：使用插件的 FFmpeg 路径设置（无需修改 PATH）

如果不想修改系统 PATH，可以使用插件的 FFmpeg 路径设置功能：

1. **打开视频管理器**
   - 快捷键：`Ctrl + Alt + V`
   - 或通过超级面板打开

2. **点击"FFmpeg设置"按钮**
   - 位于工具栏

3. **输入 FFmpeg 完整路径**
   ```
   E:\Program\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
   ```

4. **测试路径**
   - 点击"测试路径"按钮
   - 确认显示"✅ 路径有效"

5. **保存设置**
   - 点击"保存"按钮
   - 插件将记住这个路径

## 3. 验证 FFmpeg 功能

### 测试视频合并

1. 准备 2 个 MP4 视频文件
2. 放到 `data/video/` 目录
3. 打开视频管理器
4. 点击"视频合并"
5. 选择 2 个视频
6. 点击"开始合并"

### 测试视频音频合并

1. 准备 1 个视频文件和 1 个音频文件（.mp3, .wav, .ogg）
2. 放到 `data/video/` 目录
3. 打开视频管理器
4. 点击"视频音频合并"
5. 选择视频和音频
6. 点击"开始合并"

### 测试视频压缩

1. 准备 1 个视频文件
2. 放到 `data/video/` 目录
3. 打开视频管理器
4. 点击"视频压缩"
5. 选择视频
6. 选择压缩模式（CRF 或比特率）
7. 点击"开始压缩"

## 4. 常见问题

### 问题 1：FFmpeg 未检测到

**症状**：工具栏显示"FFmpeg 未安装，部分功能不可用"

**解决方案**：
1. 检查 FFmpeg 是否已安装
2. 如果使用方法一（PATH），验证 PATH 是否正确
3. 如果使用方法二（插件设置），检查路径是否正确
4. 重启思源笔记

### 问题 2：路径包含中文字符

**症状**：操作失败，提示路径错误

**解决方案**：
1. 将视频文件重命名为英文或数字
2. 或者将 FFmpeg 安装到英文路径

### 问题 3：权限问题

**症状**：操作失败，提示权限不足

**解决方案**：
1. 以管理员权限运行思源笔记
2. 检查防病毒软件是否阻止了 FFmpeg

### 问题 4：操作超时

**症状**：大文件处理时间很长

**解决方案**：
1. 这是正常现象，视频处理需要时间
2. 大文件可能需要几分钟到几十分钟
3. 请耐心等待

## 5. FFmpeg 路径示例

### Windows 常见路径
```
C:\ffmpeg\bin\ffmpeg.exe
C:\Program Files\ffmpeg\bin\ffmpeg.exe
D:\ffmpeg\bin\ffmpeg.exe
E:\Program\ffmpeg-8.0.1-essentials_build\bin\ffmpeg.exe
```

### macOS 常见路径
```
/usr/local/bin/ffmpeg
/usr/bin/ffmpeg
/opt/homebrew/bin/ffmpeg
```

### Linux 常见路径
```
/usr/bin/ffmpeg
/usr/local/bin/ffmpeg
```

## 6. 卸载 FFmpeg

如果需要卸载 FFmpeg：

### Windows
1. 删除 FFmpeg 文件夹
2. 从系统 PATH 中移除 FFmpeg 路径
3. 在插件中点击"重置"按钮清除自定义路径

### macOS/Linux
```bash
# macOS
brew uninstall ffmpeg

# Linux
sudo apt remove ffmpeg
```

## 7. 技术支持

如果遇到问题：

1. **检查 FFmpeg 版本**
   ```bash
   ffmpeg -version
   ```

2. **查看浏览器控制台**（F12）
   - 查看详细的错误信息

3. **检查文件路径**
   - 确保文件路径不含中文
   - 确保文件可读取

4. **联系开发者**
   - 提供错误信息截图
   - 提供 FFmpeg 版本信息
   - 提供操作系统信息
