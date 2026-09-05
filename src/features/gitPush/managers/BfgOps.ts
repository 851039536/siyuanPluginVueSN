// BFG Repo-Cleaner 运行时层：Java 探测 + bfg.jar 下载缓存 + bfg 进程执行
import type { BfgPrefs } from "../types/meta"
import { getNodeFsPathOs, getNodeHttp, getNodeProcessModules } from "@/utils/nodeModules"
import { getWorkspaceDir } from "@/api"
import type { Plugin } from "siyuan"

/** BFG 版本（升级时同步更换下载 URL） */
export const BFG_VERSION = "1.15.0"
/** Maven Central 主源 */
const BFG_URL_PRIMARY = `https://repo1.maven.org/maven2/com/madgag/bfg/${BFG_VERSION}/bfg-${BFG_VERSION}.jar`
/** GitHub Release 备源（主源失败时切换） */
const BFG_URL_FALLBACK = `https://github.com/rtyley/bfg-repo-cleaner/releases/download/v${BFG_VERSION}/bfg-${BFG_VERSION}.jar`
/** bfg 进程默认超时（大仓库历史重写耗时较长） */
const BFG_TIMEOUT_MS = 600000
/** java -version 探测超时 */
const JAVA_DETECT_TIMEOUT_MS = 5000

/** Java 探测结果 */
export interface JavaDetectResult {
  ok: boolean
  version: string
  path: string
}

/** 解析 java -version 输出中的版本串（输出在 stderr，如 openjdk version "17.0.2"） */
function parseJavaVersion(output: string): string {
  const m = output.match(/(?:openjdk|java|version)\s+version\s+"([^"]+)"/i) || output.match(/"(\d+[\d._]*)"/)
  return m ? m[1] : ""
}

export class BfgOps {
  private plugin: Plugin
  private prefs: { load: () => Promise<BfgPrefs> }

  constructor(plugin: Plugin, prefs: { load: () => Promise<BfgPrefs> }) {
    this.plugin = plugin
    this.prefs = prefs
  }

  /** 解析 java 可执行文件名（Windows 补 .exe） */
  private javaBin(base = "java"): string {
    return process.platform === "win32" ? `${base}.exe` : base
  }

  /** 按优先级解析 java 路径候选：用户自定义 → JAVA_HOME → PATH（顺序由调用方保证） */
  private async resolveJavaPath(): Promise<string> {
    const prefs = await this.prefs.load()
    if (prefs.javaPath) return prefs.javaPath

    const { fs, path } = getNodeFsPathOs() || {}
    const javaHome = process.env.JAVA_HOME
    if (javaHome && fs && path) {
      const candidate = path.join(javaHome, "bin", this.javaBin())
      try {
        if (fs.existsSync(candidate)) return candidate
      } catch { /* 探测失败继续走 PATH */ }
    }
    return this.javaBin()
  }

  /**
   * 探测 Java 运行时（java -version 版本串输出在 stderr）
   * 探测顺序：bfgPrefs.javaPath → $JAVA_HOME/bin/java → PATH
   */
  async detectJava(): Promise<JavaDetectResult> {
    const cp = getNodeProcessModules()?.child_process
    if (!cp) return { ok: false, version: "", path: "" }

    const javaPath = await this.resolveJavaPath()
    return new Promise<JavaDetectResult>((resolve) => {
      try {
        cp.execFile(
          javaPath, ["-version"],
          { timeout: JAVA_DETECT_TIMEOUT_MS, windowsHide: true },
          (error: (Error & { killed?: boolean }) | null, _stdout: string, stderr: string) => {
            // java -version 成功时也输出到 stderr（error 为 null 即探测成功）
            if (error) {
              resolve({ ok: false, version: "", path: javaPath })
              return
            }
            resolve({ ok: true, version: parseJavaVersion(stderr), path: javaPath })
          },
        )
      } catch {
        resolve({ ok: false, version: "", path: javaPath })
      }
    })
  }

  /** bfg.jar 缓存目录：<workspace>/data/storage/petal/<plugin.name>/bin/ */
  async getJarDir(): Promise<string> {
    const workspace = await getWorkspaceDir()
    if (!workspace) return ""
    const node = getNodeFsPathOs()
    if (!node) return ""
    return node.path.join(workspace, "data", "storage", "petal", this.plugin.name, "bin")
  }

  /** bfg.jar 实际路径：用户自定义覆盖 → 默认缓存路径；jarOk 表示文件是否存在 */
  async getJarState(): Promise<{ jarPath: string, jarOk: boolean }> {
    const prefs = await this.prefs.load()
    const node = getNodeFsPathOs()
    if (!node) return { jarPath: "", jarOk: false }
    const { fs } = node

    if (prefs.jarPath) {
      try {
        return { jarPath: prefs.jarPath, jarOk: fs.existsSync(prefs.jarPath) }
      } catch {
        return { jarPath: prefs.jarPath, jarOk: false }
      }
    }

    const jarDir = await this.getJarDir()
    if (!jarDir) return { jarPath: "", jarOk: false }
    const jarPath = node.path.join(jarDir, `bfg-${BFG_VERSION}.jar`)
    try {
      return { jarPath, jarOk: fs.existsSync(jarPath) }
    } catch {
      return { jarPath, jarOk: false }
    }
  }

  /**
   * 下载 bfg.jar 到插件数据目录（主源失败自动切备源；流式写盘 + 进度回调，临时文件 rename 原子落位）
   * @param onProgress 进度回调（0~100）
   */
  async downloadJar(onProgress?: (pct: number) => void): Promise<string> {
    const node = getNodeFsPathOs()
    const http = getNodeHttp()
    if (!node || !http) throw new Error("当前环境不支持文件下载")
    const { fs, path } = node

    const jarDir = await this.getJarDir()
    if (!jarDir) throw new Error("无法获取工作区路径，请手动下载 bfg.jar 并在设置中指定路径")
    fs.mkdirSync(jarDir, { recursive: true })
    const jarPath = path.join(jarDir, `bfg-${BFG_VERSION}.jar`)
    const tmpPath = `${jarPath}.download`

    let lastError: Error | null = null
    for (const url of [BFG_URL_PRIMARY, BFG_URL_FALLBACK]) {
      try {
        await this.downloadToFile(url, tmpPath, onProgress)
        fs.renameSync(tmpPath, jarPath)
        return jarPath
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        try { fs.rmSync(tmpPath, { force: true }) } catch { /* 忽略 */ }
      }
    }
    throw new Error(`bfg.jar 下载失败（主源与备源均不可达）：${lastError?.message || "未知错误"}\n可手动下载 bfg-${BFG_VERSION}.jar 后在 gitPush 设置中指定 jar 路径`)
  }

  /** Node https 直连下载到文件（跟随 30x 重定向，流式写盘防大文件驻留内存） */
  private downloadToFile(url: string, destPath: string, onProgress?: (pct: number) => void): Promise<void> {
    const http = getNodeHttp()
    const node = getNodeFsPathOs()
    if (!http || !node) return Promise.reject(new Error("当前环境不支持文件下载"))
    const { fs } = node

    return new Promise((resolve, reject) => {
      const request = (targetUrl: string, redirectsLeft: number) => {
        const req = http.https.get(targetUrl, (res) => {
          // 跟随重定向（Maven Central / GitHub Release 均可能 30x）
          if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            res.resume()
            if (redirectsLeft <= 0) {
              reject(new Error("重定向次数过多"))
              return
            }
            request(res.headers.location, redirectsLeft - 1)
            return
          }
          if (res.statusCode !== 200) {
            res.resume()
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }

          const total = Number(res.headers["content-length"]) || 0
          let received = 0
          const stream = fs.createWriteStream(destPath)
          res.on("data", (chunk: { length: number }) => {
            received += chunk.length
            if (onProgress && total > 0) {
              onProgress(Math.min(100, Math.round((received / total) * 100)))
            }
          })
          res.pipe(stream)
          stream.on("finish", () => resolve())
          stream.on("error", reject)
          res.on("error", reject)
        })
        req.on("error", reject)
        req.setTimeout(60000, () => {
          req.destroy(new Error("下载超时（60s 无响应）"))
        })
      }
      request(url, 5)
    })
  }

  /**
   * 执行 bfg 进程（java -jar bfg.jar <args> <repo>）
   * @param cwd 工作目录（bfg 对 cwd 敏感度低，传仓库所在目录即可）
   * @param onOutput 流式输出回调（bfg 进度日志走 stdout）
   */
  async runBfg(jarPath: string, javaPath: string, args: string[], cwd: string, onOutput?: (chunk: string) => void): Promise<string> {
    const cp = getNodeProcessModules()?.child_process
    if (!cp) throw new Error("Node 环境不可用")
    return new Promise((resolve, reject) => {
      const child = cp.execFile(
        javaPath, ["-jar", jarPath, ...args],
        { cwd, timeout: BFG_TIMEOUT_MS, windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
        (error: (Error & { killed?: boolean }) | null, stdout: string, stderr: string) => {
          if (error) {
            const reason = error.killed ? "bfg 执行超时（已终止）" : "bfg 执行失败"
            reject(new Error(stderr ? `${reason}\n${stderr}` : `${reason}: ${error.message}`))
          } else {
            resolve(stdout)
          }
        },
      )
      if (onOutput) {
        child.stdout?.on("data", (d: Buffer | string) => onOutput(String(d)))
        child.stderr?.on("data", (d: Buffer | string) => onOutput(String(d)))
      }
    })
  }
}
