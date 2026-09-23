import type { Ref } from "vue"
import type {
  CodeReportData,
  GitProject,
} from "../types"
import { showMessage } from "siyuan"
// gitPush 代码统计报告 — 一键导出单文件 HTML 编排
//
// 职责：校验可导出 → 弹保存对话框 → 渲染 HTML → 写盘 → 提示并打开。
// 渲染本身是纯函数（见 ../htmlReport），此处只负责 IO 与用户反馈。
import { ref } from "vue"
import {
  openPathInShell,
  pickSavePath,
} from "@/utils/electronDialog"
import { getNodeModules } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import {
  buildHtmlReport,
  reportFileName,
} from "../htmlReport"

/** 报告导出文件的类型过滤（保存对话框用） */
const HTML_FILTER = [{
  name: "HTML",
  extensions: ["html"],
}]

export function useReportExport(deps: {
  i18n: Record<string, any>
  report: Ref<CodeReportData>
  /** 当前生效项目（选中项优先，由 useCodeReport 推导） */
  currentProject: Ref<GitProject | null>
  /** 是否已生成过至少一轮 */
  generated: Ref<boolean>
  /** 报告生成中（生成期间禁止导出，避免导出半成品） */
  running: Ref<boolean>
}) {
  /** 导出中标记（并发去重，防止重复点击写多份文件） */
  const exporting = ref(false)

  /**
   * 一键导出当前报告为单文件 HTML。
   *
   * 失败语义分层：不可导出（未生成/无数据）走 info 提示不产文件；
   * 环境不支持（无 Node）与非桌面环境走专门文案；
   * 渲染或写盘异常走 error 提示并带原因。
   */
  async function exportHtml(): Promise<void> {
    if (exporting.value || deps.running.value) return

    const project = deps.currentProject.value
    const report = deps.report.value
    // 未生成 / git 失败 / 零提交：不产出空报告文件
    if (!deps.generated.value || !report.ok || !project || report.totalCommits === 0) {
      showMessage(deps.i18n.reportExportNotReady, 3000, "info")
      return
    }

    const node = getNodeModules()
    if (!node) {
      showMessage(deps.i18n.reportExportDesktopOnly, 3000, "error")
      return
    }

    exporting.value = true
    try {
      const fileName = reportFileName(project.name, report.generatedAt)
      const targetPath = await pickSavePath(deps.i18n.reportExport, fileName, HTML_FILTER)
      // 用户取消保存：静默返回，不打扰
      if (!targetPath) return

      const html = buildHtmlReport(
        report,
        {
          projectName: project.name,
          projectPath: project.path,
          rangeLabel: report.rangeLabel,
          generatedAt: report.generatedAt,
        },
        deps.i18n,
      )
      await node.fs.promises.writeFile(targetPath, html, "utf8")

      showMessage(deps.i18n.reportExportSuccess.replace("\{0\}", targetPath), 5000, "info")
      // 写盘成功后打开，便于用户立即查看（打开失败不影响导出结论，静默忽略）
      void openPathInShell(targetPath).catch(() => false)
    } catch (err) {
      showMessage(deps.i18n.reportExportFailed.replace("\{0\}", getErrorMessage(err)), 5000, "error")
    } finally {
      exporting.value = false
    }
  }

  return {
    exporting,
    exportHtml,
  }
}
