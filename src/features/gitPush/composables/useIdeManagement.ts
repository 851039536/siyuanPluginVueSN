import { ref } from "vue"
import { getNodeProcessModules, getNodeModules } from "@/utils/nodeModules"

// Types
export interface IdeEntry {
  name: string
  icon: string
  cmds: string[]
  knownPaths: string[]
}

export interface CustomIde { name: string; path: string }

// Constants
export const IDE_ENTRIES: IdeEntry[] = [
  {
    name: "VSCode", icon: "mdi:microsoft-visual-studio-code",
    cmds: ["code", "code.cmd"],
    knownPaths: [
      "%LOCALAPPDATA%/Programs/Microsoft VS Code/bin/code.cmd",
      "C:/Program Files/Microsoft VS Code/bin/code.cmd",
    ],
  },
]

export const IDE_PRESETS = [
  { name: "Visual Studio", icon: "mdi:microsoft-visual-studio" },
  { name: "JetBrains Rider", icon: "mdi:language-csharp" },
  { name: "CodeBuddy", icon: "mdi:robot-outline" },
  { name: "Trae CN", icon: "mdi:alpha-t-box" },
  { name: "Qoder", icon: "mdi:code-json" },
  { name: "JetBrains WebStorm", icon: "mdi:language-javascript" },
  { name: "JetBrains PyCharm", icon: "mdi:language-python" },
  { name: "JetBrains GoLand", icon: "mdi:language-go" },
  { name: "JetBrains IntelliJ IDEA", icon: "mdi:language-java" },
  { name: "其他", icon: "mdi:application-brackets" },
]

export const CUSTOM_IDE_KEY = "git-push-custom-ides"

export function useIdeManagement(options: {
  plugin: { loadData(key: string): Promise<any>; saveData(key: string, value: any): Promise<void> }
  /** 打开文件夹的回退函数 */
  openFolder: (path: string) => void
}) {
  const { plugin, openFolder } = options

  const detectedIdes = ref<IdeEntry[]>([])
  const customIdes = ref<CustomIde[]>([])
  const confirmingDelIdx = ref(-1)

  const showIdeDialog = ref(false)
  const addIdePreset = ref("Visual Studio")
  const addIdePath = ref("")
  const editingIdeIdx = ref(-1)
  const editIdePreset = ref("")
  const editIdePath = ref("")
  const confirmingMgmtDelIdx = ref(-1)

  function getIdePresetIcon(name: string): string {
    return IDE_PRESETS.find(p => p.name === name)?.icon ?? "mdi:application-brackets"
  }

  function startEditIde(idx: number) {
    const c = customIdes.value[idx]
    if (!c) return
    editingIdeIdx.value = idx
    editIdePreset.value = IDE_PRESETS.some(p => p.name === c.name) ? c.name : "其他"
    editIdePath.value = c.path
  }

  function saveEditIde(idx: number) {
    const list = [...customIdes.value]
    list[idx] = { name: editIdePreset.value.trim() || customIdes.value[idx].name, path: editIdePath.value.trim() }
    customIdes.value = list
    editingIdeIdx.value = -1
    confirmingMgmtDelIdx.value = -1
    saveCustomIdes()
  }

  async function loadCustomIdes() {
    try {
      const data = await plugin.loadData(CUSTOM_IDE_KEY)
      if (Array.isArray(data)) customIdes.value = data
    } catch { /* ignore */ }
  }

  async function saveCustomIdes() {
    try { await plugin.saveData(CUSTOM_IDE_KEY, customIdes.value) }
    catch { /* ignore */ }
  }

  function addCustomIde() {
    const path = addIdePath.value.trim()
    if (!path) return
    customIdes.value = [...customIdes.value, { name: addIdePreset.value, path }]
    saveCustomIdes()
    addIdePath.value = ""
  }

  function doRemoveCustomIde(idx: number) {
    customIdes.value = customIdes.value.filter((_, i) => i !== idx)
    confirmingDelIdx.value = -1
    confirmingMgmtDelIdx.value = -1
    saveCustomIdes()
  }

  // ---- IDE launch helpers ----

  async function findSlnFile(dir: string): Promise<string | null> {
    const nodeModules = getNodeModules()
    if (!nodeModules) return null
    try {
      const entries = await nodeModules.fs.promises.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith(".sln")) {
          return nodeModules.path.join(dir, e.name)
        }
      }
    } catch { /* ignore */ }
    return null
  }

  function resolvePath(raw: string): string | null {
    let resolved = raw
    const matches = raw.match(/%([^%]+)%/g)
    if (matches) {
      const env: Record<string, string | undefined> = {}
      try {
        const nodeModules = getNodeModules()
        if (nodeModules) {
          const proc = (globalThis as any).process
          if (proc?.env) Object.assign(env, proc.env)
        }
      } catch { /* ignore */ }
      for (const m of matches) {
        const key = m.slice(1, -1)
        const val = env[key]
        if (!val) return null
        resolved = resolved.replace(m, val)
      }
    }
    return resolved
  }

  function launchIde(cp: any, cmd: string, args: string[]): Promise<void> {
    try {
      const child = cp.spawn(cmd, args, {
        detached: true,
        stdio: "ignore",
        windowsHide: false,
      })
      child.unref()
      return Promise.resolve()
    } catch (e) {
      return Promise.reject(e)
    }
  }

  function isCmdAvailable(cp: any, cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        let settled = false
        const child = cp.spawn(cmd, ["--version"], {
          stdio: "ignore",
          windowsHide: true,
          timeout: 3000,
        })
        child.on("error", (err: any) => {
          if (!settled) {
            settled = true
            resolve(err?.code !== "ENOENT")
          }
        })
        child.on("close", (code: number | null) => {
          if (!settled) {
            settled = true
            resolve(code === 0)
          }
        })
        child.unref()
      } catch {
        resolve(false)
      }
    })
  }

  async function scanIdes() {
    const nodeModules = getNodeProcessModules()
    const cp = nodeModules?.child_process
    if (!cp) { detectedIdes.value = [...IDE_ENTRIES]; return }

    const found: IdeEntry[] = []
    for (const ide of IDE_ENTRIES) {
      let installed = false
      for (const cmdName of ide.cmds) {
        if (await isCmdAvailable(cp, cmdName)) { installed = true; break }
      }
      if (!installed) {
        const fs = getNodeModules()?.fs
        if (fs) {
          for (const rawPath of ide.knownPaths) {
            const resolved = resolvePath(rawPath)
            if (resolved && fs.existsSync(resolved)) { installed = true; break }
          }
        }
      }
      if (installed) found.push(ide)
    }
    detectedIdes.value = found
  }

  async function handleOpenIde(path: string, ide: IdeEntry) {
    const nodeModules = getNodeProcessModules()
    const cp = nodeModules?.child_process
    if (!cp) { openFolder(path); return }

    for (const cmdName of ide.cmds) {
      try { await launchIde(cp, cmdName, [path]); return }
      catch { /* 继续 */ }
    }
    const fs = getNodeModules()?.fs
    for (const rawPath of ide.knownPaths) {
      const resolved = resolvePath(rawPath)
      if (resolved && fs?.existsSync(resolved)) {
        try { await launchIde(cp, resolved, [path]); return }
        catch { /* 继续 */ }
      }
    }
    openFolder(path)
  }

  async function handleOpenCustomIde(projectPath: string, ideName: string, idePath: string) {
    let target = projectPath
    if (/rider|visual\s*studio/i.test(ideName)) {
      const sln = await findSlnFile(projectPath)
      if (sln) target = sln
    }
    const nodeModules = getNodeProcessModules()
    const cp = nodeModules?.child_process
    if (cp) {
      try { await launchIde(cp, idePath, [target]); return }
      catch { /* fallback */ }
    }
    openFolder(projectPath)
  }

  return {
    detectedIdes,
    customIdes,
    confirmingDelIdx,
    showIdeDialog,
    addIdePreset,
    addIdePath,
    editingIdeIdx,
    editIdePreset,
    editIdePath,
    confirmingMgmtDelIdx,
    getIdePresetIcon,
    startEditIde,
    saveEditIde,
    loadCustomIdes,
    saveCustomIdes,
    addCustomIde,
    doRemoveCustomIde,
    handleOpenCustomIde,
    scanIdes,
    handleOpenIde,
    findSlnFile,
  }
}
