<!--
  ⚠️ 已废弃 / DEPRECATED —— 请删除本文件（删除命令见下方）。

  本组件「最近提交记录」区块已按需求从提交概览中移除：
  - 引用与渲染已从 CommitAnalysis/index.vue 移除
  - 其专属样式（.gpa-commit-*）已从 CommitAnalysisPanel.scss 移除
  - README 组件清单已移除本条目

  目前本文件已无任何 import 引用（Vite 会 tree-shake，不会进入构建产物），
  保留仅为占位：当前会话的 shell 被沙箱 ACL 阻断（任何命令都报
  `SetNamedSecurityInfoW failed (Win32 5): grantWrite`），无法执行删除。

  请在普通终端中执行以下任一条目以彻底删除：

    Remove-Item -LiteralPath 'E:\programDevelopment\plugin\siyuanPluginVueSN\src\features\gitPush\components\CommitAnalysis\RecentCommitsSection.vue' -Force

  或（Git Bash / WSL）：
    rm 'E:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/CommitAnalysis/RecentCommitsSection.vue'

  如需恢复该区块，可从 git 历史中取回本文件，并还原 index.vue 的 import 与
  CommitAnalysisPanel.scss 中的 .gpa-commit-* 规则。
-->
