# Git 推送 (gitPush)

同时推送到 GitHub 和 Gitee，持久化项目路径映射。

## 功能

- **项目映射**：添加本地 Git 项目路径，持久化保存（不影响项目本身）
- **远程检测**：自动检测 `github.com` 和 `gitee.com` 远程仓库
- **双平台推送**：一键同时推送到 GitHub 和 Gitee
- **路径检查**：添加时检查路径是否为合法 Git 仓库

## 使用

1. 在超级面板中启用「Git 推送」
2. 点击「添加项目」，输入名称和选择项目路径
3. 面板自动检测 GitHub/Gitee 远程
4. 点击「推送到 GitHub + Gitee」同步推送

## 存储

项目映射通过 `PluginStorage` 持久化，存储在 `git-push-projects` key 中。
