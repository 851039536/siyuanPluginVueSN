// gitPush 工作区文件树右键菜单构建（纯函数：条目集合、禁用态与动作绑定）
//
// 抽出为纯函数的理由：菜单项集合随「文件行 / 目录行」「绝对路径是否可用」组合变化，
// 放组件里会与模板交织；这里只产数据，复制/打开等副作用经 actions 回注。
import type { TieredMenuItem } from "@/components/TieredMenu.vue"
import type { PathTreeRow } from "./fileTree"

/** 右键菜单可用动作（副作用由视图层提供：复制反馈、reveal、默认程序打开） */
export interface WorkspaceRowMenuActions {
  /** 复制文本（成功后由视图层给行内反馈） */
  copy: (text: string) => void
  /** 在文件管理器中显示（绝对路径不可用时条目已禁用，不会触发） */
  reveal: () => void
  /** 用默认程序 / 资源管理器打开（绝对路径不可用时条目已禁用） */
  open: () => void
  /** 绝对路径是否可用（Node 能力缺失或解析越界时为 false，相关条目禁用） */
  absolutePathAvailable: boolean
}

/**
 * 构建某一行（文件 / 目录）的右键菜单项。
 * @param row 树行
 * @param i18n 文案对象（gitPush 分组）
 * @param actions 动作绑定
 */
export function buildWorkspaceRowMenu(
  row: PathTreeRow,
  i18n: Record<string, any>,
  actions: WorkspaceRowMenuActions,
): TieredMenuItem[] {
  const enabled = actions.absolutePathAvailable
  const copyItems: TieredMenuItem[] = [
    {
      key: "copy-name",
      label: row.type === "dir" ? i18n.copyFolderName : i18n.copyFileName,
      icon: "copy",
      command: () => actions.copy(row.name),
    },
    {
      key: "copy-path",
      label: i18n.workspaceFilesCopyPath,
      icon: "copy",
      command: () => actions.copy(row.path),
    },
    {
      key: "copy-abs-path",
      label: i18n.workspaceFilesCopyAbsPath,
      icon: "copy",
      disabled: !enabled,
    },
  ]
  if (row.type === "dir") {
    return [
      ...copyItems,
      { key: "separator", separator: true },
      {
        key: "reveal",
        label: i18n.workspaceFilesReveal,
        icon: "folderOpen",
        disabled: !enabled,
        command: () => actions.reveal(),
      },
      {
        key: "open-folder",
        label: i18n.openFolder,
        icon: "folderOpen",
        disabled: !enabled,
        command: () => actions.open(),
      },
    ]
  }
  return [
    ...copyItems,
    { key: "separator", separator: true },
    {
      key: "reveal",
      label: i18n.workspaceFilesReveal,
      icon: "folderOpen",
      disabled: !enabled,
      command: () => actions.reveal(),
    },
    {
      key: "open-default",
      label: i18n.workspaceFilesOpenDefault,
      icon: "openInNew",
      disabled: !enabled,
      command: () => actions.open(),
    },
  ]
}
