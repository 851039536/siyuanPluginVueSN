// 项目脚本识别纯函数单测 —— 识别结果直接决定用户能一键运行哪些命令，
// 命令构建错误（参数错位/漏 run/错解释器）会让执行失败或跑错目标，逐分支覆盖：
//   - 包管理器按锁文件判定（pnpm > yarn > npm 缺省）
//   - package.json 解析容错（非 JSON / 无 scripts / 非字符串值）
//   - sln 与 csproj 的 dotnet 动词差异（run 仅 csproj）
//   - 独立脚本文件按平台选解释器（ps1→powershell/pwsh，bat·cmd→cmd，sh→bash）
//   - 目录归类过滤（跳过 node_modules/bin/obj 等产物目录；脚本文件限 2 层深度）
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  buildDotnetGroup,
  buildPackageGroup,
  buildScriptFileGroup,
  buildScriptGroups,
  classifyScriptFiles,
  detectPackageManager,
  formatCommandLine,
  parsePackageJsonScripts,
  shellQuote,
} from "./scriptScan"

describe("detectPackageManager", () => {
  it("pnpm-lock.yaml 优先判定为 pnpm", () => {
    expect(detectPackageManager(["package.json", "pnpm-lock.yaml", "yarn.lock"])).toBe("pnpm")
  })

  it("仅 yarn.lock 判定为 yarn", () => {
    expect(detectPackageManager(["package.json", "yarn.lock"])).toBe("yarn")
  })

  it("无锁文件缺省 npm", () => {
    expect(detectPackageManager(["package.json"])).toBe("npm")
    expect(detectPackageManager([])).toBe("npm")
  })
})

describe("parsePackageJsonScripts", () => {
  it("解析 name 与 scripts", () => {
    const r = parsePackageJsonScripts(JSON.stringify({ name: "app", scripts: { dev: "vite", build: "vite build" } }))
    expect(r).toEqual({ name: "app", scripts: { dev: "vite", build: "vite build" } })
  })

  it("非 JSON 返回 null", () => {
    expect(parsePackageJsonScripts("{ oops")).toBeNull()
  })

  it("无 scripts 或空 scripts 返回 null", () => {
    expect(parsePackageJsonScripts(JSON.stringify({ name: "app" }))).toBeNull()
    expect(parsePackageJsonScripts(JSON.stringify({ scripts: {} }))).toBeNull()
  })

  it("过滤非字符串的脚本值", () => {
    const r = parsePackageJsonScripts(JSON.stringify({ scripts: { dev: "vite", bad: 42 } }))
    expect(r?.scripts).toEqual({ dev: "vite" })
  })
})

describe("shellQuote / formatCommandLine", () => {
  it("普通参数不加引号", () => {
    expect(shellQuote("build")).toBe("build")
    expect(formatCommandLine("dotnet", ["build", "app.sln"])).toBe("dotnet build app.sln")
  })

  it("含空格/元字符参数加引号", () => {
    expect(shellQuote("My App.sln")).toBe("\"My App.sln\"")
    expect(formatCommandLine("dotnet", ["build", "My App.sln"])).toBe("dotnet build \"My App.sln\"")
  })
})

describe("buildPackageGroup", () => {
  it("生成 npm run 命令且保留脚本内容", () => {
    const g = buildPackageGroup("/proj", "package.json", "app", { dev: "vite --host" }, "npm")
    expect(g.kind).toBe("package")
    expect(g.source).toBe("app")
    expect(g.scripts).toHaveLength(1)
    expect(g.scripts[0].command).toBe("npm")
    expect(g.scripts[0].args).toEqual(["run", "dev"])
    expect(g.scripts[0].preview).toBe("npm run dev")
    expect(g.scripts[0].detail).toBe("vite --host")
    expect(g.scripts[0].cwd).toBe("/proj")
  })

  it("子目录 package.json 分组名带目录前缀", () => {
    const g = buildPackageGroup("/proj", "packages/ui/package.json", "@app/ui", { build: "tsc" }, "pnpm")
    expect(g.source).toBe("packages/ui · @app/ui")
    expect(g.scripts[0].command).toBe("pnpm")
    expect(g.scripts[0].args).toEqual(["run", "build"])
  })
})

describe("buildDotnetGroup", () => {
  it("sln 提供 restore/build/test/publish，不含 run", () => {
    const g = buildDotnetGroup("/proj", "src/MyApp.sln")
    expect(g.kind).toBe("dotnet")
    expect(g.scripts.map((s) => s.label)).toEqual(["restore", "build", "test", "publish"])
    expect(g.scripts[0].command).toBe("dotnet")
    expect(g.scripts[1].args).toEqual(["build", "src/MyApp.sln"])
    expect(g.scripts[1].preview).toBe("dotnet build src/MyApp.sln")
  })

  it("csproj 额外提供 run（--project 形式）", () => {
    const g = buildDotnetGroup("/proj", "src/App/App.csproj")
    expect(g.scripts.map((s) => s.label)).toEqual(["restore", "build", "run", "test", "publish"])
    const run = g.scripts.find((s) => s.label === "run")!
    expect(run.args).toEqual(["run", "--project", "src/App/App.csproj"])
  })
})

describe("buildScriptFileGroup", () => {
  it("win32 下 ps1 用 powershell、bat 用 cmd /c", () => {
    const g = buildScriptFileGroup("/proj", ["scripts/deploy.ps1", "build.bat"], "win32")
    expect(g.kind).toBe("scriptFile")
    expect(g.scripts[0].command).toBe("powershell")
    expect(g.scripts[0].args).toEqual(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "scripts/deploy.ps1"])
    expect(g.scripts[1].command).toBe("cmd")
    expect(g.scripts[1].args).toEqual(["/c", "build.bat"])
  })

  it("linux 下 ps1 用 pwsh、sh 用 sh", () => {
    const g = buildScriptFileGroup("/proj", ["scripts/deploy.ps1", "scripts/go.sh"], "linux")
    expect(g.scripts[0].command).toBe("pwsh")
    expect(g.scripts[0].args).toEqual(["-File", "scripts/deploy.ps1"])
    expect(g.scripts[1].command).toBe("sh")
    expect(g.scripts[1].args).toEqual(["scripts/go.sh"])
  })
})

describe("classifyScriptFiles", () => {
  it("识别 package.json / sln / csproj 并跳过产物目录", () => {
    const r = classifyScriptFiles([
      "package.json",
      "node_modules/x/package.json",
      "src/MyApp.sln",
      "src/App/App.csproj",
      "src/App/bin/Debug/App.csproj",
      "src/App/obj/App.csproj",
    ])
    expect(r.packages).toEqual(["package.json"])
    expect(r.dotnet).toEqual(["src/MyApp.sln", "src/App/App.csproj"])
  })

  it("独立脚本文件限 1 级子目录", () => {
    const r = classifyScriptFiles([
      "run.ps1",
      "scripts/deploy.sh",
      "a/b/deep.bat",
    ])
    expect(r.scriptFiles).toEqual(["run.ps1", "scripts/deploy.sh"])
  })
})

describe("buildScriptGroups", () => {
  it("聚合三类分组并按锁文件选包管理器", () => {
    const r = buildScriptGroups("/proj", {
      rootFiles: ["package.json", "pnpm-lock.yaml"],
      packages: [{ file: "package.json", content: JSON.stringify({ scripts: { dev: "vite" } }) }],
      dotnet: ["MyApp.sln"],
      scriptFiles: ["deploy.ps1"],
      platform: "win32",
    })
    expect(r.root).toBe("/proj")
    expect(r.groups.map((g) => g.kind)).toEqual(["package", "dotnet", "scriptFile"])
    expect(r.groups[0].scripts[0].command).toBe("pnpm")
    expect(r.groups[1].scripts.map((s) => s.label)).toEqual(["restore", "build", "test", "publish"])
    expect(r.groups[2].scripts[0].label).toBe("deploy.ps1")
  })

  it("坏 package.json 被跳过但其余分组正常", () => {
    const r = buildScriptGroups("/proj", {
      rootFiles: [],
      packages: [{ file: "package.json", content: "not-json" }],
      dotnet: ["MyApp.sln"],
      scriptFiles: [],
      platform: "linux",
    })
    expect(r.groups.map((g) => g.kind)).toEqual(["dotnet"])
  })
})
