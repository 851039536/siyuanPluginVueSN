// Electron shell 通道探测与「移入系统回收站」的唯一执行入口。
//
// 供 `useResultActions`（单条结果删除）与 `cacheScan/cleaner`（批量清理）共用，
// 避免两处各写一份「remote 优先、local 兜底」的通道枚举。
// 本文件**不 import 任何会触达 siyuan / DOM 的模块**（才能在纯 Node 单测中加载）。

import { getElectronModules, getElectronRemoteShell } from "@/utils/nodeModules"

/** 回收站操作所需的最小 shell 形状（remote / local 同构） */
export interface TrashShell {
  trashItem?: (path: string) => Promise<void>
  moveItemToTrash?: (path: string) => boolean
}

/** 一条可用通道（`name` 仅用于返回实际执行通道，便于排查「为什么删不掉」） */
export interface ShellChannel {
  name: string
  shell: TrashShell
}

/** 探测可用通道：remote（主进程桥接）优先，local（渲染进程 shell）兜底 */
export function listTrashChannels(): ShellChannel[] {
  const channels: ShellChannel[] = []
  const remote = getElectronRemoteShell()
  if (remote) channels.push({ name: "remote", shell: remote })
  const local = getElectronModules()?.shell
  if (local) channels.push({ name: "local", shell: local })
  return channels
}

/**
 * 移入系统回收站（Electron 主进程 API），返回实际使用的通道名（如 `remote.trashItem`）。
 *
 * 刻意**不用** PowerShell/cmd 脚本 —— 那套行为特征会被企业安全软件判定为可疑删除并上报。
 * 通道存在但操作失败（返回 false / 抛错）时直接向上抛，**不**静默换下一条：
 * 那会把「权限被策略禁用」伪装成「已删除」。
 * 纯 Node 环境（单测）没有 window，shell 必然不可用 —— 直接抛错，由调用方记录失败。
 */
export async function trashToRecycleBin(targetPath: string): Promise<string> {
  if (typeof window === "undefined") {
    throw new Error("recycle-bin unavailable (non-Electron environment)")
  }

  for (const channel of listTrashChannels()) {
    const { shell } = channel
    if (typeof shell.trashItem === "function") {
      await shell.trashItem(targetPath)
      return `${channel.name}.trashItem`
    }
    if (typeof shell.moveItemToTrash === "function") {
      if (!shell.moveItemToTrash(targetPath)) {
        throw new Error(`${channel.name}.moveItemToTrash returned false`)
      }
      return `${channel.name}.moveItemToTrash`
    }
  }

  throw new Error("recycle-bin unavailable")
}
