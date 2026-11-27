# 提权助手（Elevation Assistant）

为常用 Windows `.exe` 工具创建快捷方式，并按需写入「以管理员身份运行」标记；同时提供权限诊断面板，显示当前思源进程的权限级别与目标程序的 manifest 权限需求。

> **平台支持：仅 Windows 桌面端**。依赖 `child_process` / PowerShell，已登记在
> `src/features/config.ts` 的 `DESKTOP_ONLY_FEATURE_IDS`，移动端不注册。

## 使用方式

1. 在右侧 Dock 打开「提权助手」。
2. 「快捷方式」页点击「添加工具」，选择一个 `.exe`。
3. 面板会解析目标 PE 的内嵌 manifest，自动给出权限结论并预选「以管理员身份运行」：
   - `requireAdministrator`：必须管理员，双击程序本身也会触发 UAC；
   - `highestAvailable`：建议管理员，管理员账户下会请求提权；
   - `asInvoker` / 无清单：默认无需管理员，可手动开启提权；
   - 无法解析：允许手动选择提权。
4. 选择快捷方式位置（桌面 / 当前用户开始菜单 / 自定义目录），保存即可。
5. 双击生成的快捷方式时，Windows 会按 `RunAsUser` 标记弹出 UAC；无需再手动右键属性勾选。

## 权限诊断

- **当前进程权限**：显示管理员 / 标准用户、完整性级别、UAC 状态、账号与思源进程信息。
  状态来自 `whoami /groups` 与注册表 `EnableLUA`（原生命令，约 0.5s），不依赖 PowerShell。
- **目标程序**：读取 PE 资源中的 `requestedExecutionLevel`，显示清单来源、执行级别、架构、`uiAccess` 与建议。
- **快捷方式状态**：检查已创建的 `.lnk` 是否存在、是否带管理员标记；可打开所在文件夹或删除（优先回收站）。
- **以管理员身份运行**：用于验证；取消 UAC 会给出提示，不会崩溃。

说明：

- 插件不会提升思源自身权限，也不能绕过 UAC。当前思源以标准用户运行时，插件启动的子进程同样是标准权限；提权快捷方式只是让 Windows 在启动目标程序时请求管理员授权。
- 创建快捷方式与启动提权程序经 PowerShell `-EncodedCommand` 执行（用户路径以 Base64 JSON 传参，不拼接进脚本）。
- 创建快捷方式本身不需要管理员权限；写入受保护目录或启动提权程序时才需要。
- 只检查内嵌清单；若只存在同目录外部 `<exe>.manifest`，会显示「外部文件」并提示 Windows 可能忽略它。
- 不校验数字签名；不支持的加壳/损坏 PE 会显示「无法判断」，可手动开启提权。

## 存储

- JSON 槽：`elevation-assistant-tools`（`ElevationTool[]`，增长型，上限 50 条）。
  - 只保存工具元数据（名称、路径、参数、工作目录、提权意图）与已创建快捷方式记录；
  - 诊断结果只存在内存，不落盘；
  - 单条改动会整份重写，但工具数量有上限，写放大小。
- 快捷方式 `.lnk` 位于用户桌面 / 当前用户开始菜单 / 用户选择的自定义目录，不属于插件数据目录，不参与插件备份；删除优先移入回收站。
- 清空 / 导出 / 还原由「数据管理」统一处理。

## 测试

纯函数单测随 `pnpm test` 运行。Windows 实机集成测试（真实拉起 `whoami` / `reg` / PowerShell
并创建临时 `.lnk`）默认跳过，需要时显式开启：

```powershell
$env:DSH_WIN_INTEGRATION="1"; pnpm exec vitest run src/features/elevationAssistant/managers
```

