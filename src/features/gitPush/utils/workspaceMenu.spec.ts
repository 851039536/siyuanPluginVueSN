// src/renderer/src/features/gitPush/utils/workspaceMenu.spec.ts — 工作区树右键菜单构建单元测试
import { describe, expect, it, vi } from "vitest"
import type { PathTreeRow } from "./fileTree"
import { buildWorkspaceRowMenu } from "./workspaceMenu"

const i18n = {
  copyFileName: "复制文件名称",
  copyFolderName: "复制文件夹名称",
  workspaceFilesCopyPath: "复制相对路径",
  workspaceFilesCopyAbsPath: "复制绝对路径",
  workspaceFilesReveal: "在文件管理器中显示",
  workspaceFilesOpenDefault: "用默认程序打开",
  openFolder: "打开文件夹",
}

const fileRow: PathTreeRow = {
  type: "file",
  key: "f:src/a.ts",
  name: "a.ts",
  path: "src/a.ts",
  depth: 1,
  count: 1,
}
const dirRow: PathTreeRow = {
  type: "dir",
  key: "src",
  name: "src",
  path: "src",
  depth: 0,
  count: 1,
}

function actions(available = true) {
  return {
    copy: vi.fn(),
    reveal: vi.fn(),
    open: vi.fn(),
    absolutePathAvailable: available,
  }
}

describe("buildWorkspaceRowMenu", () => {
  it("文件行：复制名称/相对路径/绝对路径 + 分隔线 + reveal/默认程序打开", () => {
    const menu = buildWorkspaceRowMenu(fileRow, i18n, actions())
    expect(menu.map((item) => item.separator ? "---" : item.key)).toEqual([
      "copy-name",
      "copy-path",
      "copy-abs-path",
      "---",
      "reveal",
      "open-default",
    ])
    expect(menu[0].label).toBe("复制文件名称")
  })

  it("目录行：复制文件夹名称 + 相对/绝对路径 + 打开文件夹", () => {
    const menu = buildWorkspaceRowMenu(dirRow, i18n, actions())
    expect(menu.map((item) => item.separator ? "---" : item.key)).toEqual([
      "copy-name",
      "copy-path",
      "copy-abs-path",
      "---",
      "reveal",
      "open-folder",
    ])
    expect(menu[0].label).toBe("复制文件夹名称")
    expect(menu[5].label).toBe("打开文件夹")
  })

  it("绝对路径不可用时：绝对路径复制与文件系统动作禁用", () => {
    const menu = buildWorkspaceRowMenu(fileRow, i18n, actions(false))
    const disabled = menu.filter((item) => item.disabled).map((item) => item.key)
    expect(disabled).toEqual(["copy-abs-path", "reveal", "open-default"])
    expect(menu.find((item) => item.key === "copy-name")?.disabled).toBeUndefined()
  })

  it("命令回调携带正确的复制文本与动作", () => {
    const a = actions()
    const menu = buildWorkspaceRowMenu(fileRow, i18n, a)
    const evt = {} as MouseEvent
    menu.find((item) => item.key === "copy-name")!.command!(menu[0], evt)
    menu.find((item) => item.key === "copy-path")!.command!(menu[1], evt)
    menu.find((item) => item.key === "reveal")!.command!(menu[4], evt)
    menu.find((item) => item.key === "open-default")!.command!(menu[5], evt)
    expect(a.copy).toHaveBeenNthCalledWith(1, "a.ts")
    expect(a.copy).toHaveBeenNthCalledWith(2, "src/a.ts")
    expect(a.reveal).toHaveBeenCalledTimes(1)
    expect(a.open).toHaveBeenCalledTimes(1)
  })
})
