import type {
  DiagnosisReasonCode,
  PermissionDiagnosis,
} from "../types"
/**
 * 提权助手 - 诊断结论的统一展示映射
 *
 * 结论（标签 / 颜色 / 图标）一律以 recommendation 为准，
 * 避免工具列表、编辑器与诊断报告各自按 manifestLevel 推导导致互相矛盾。
 */
import type { IconKey } from "@/components/kit/icons"

export interface DiagnosisView {
  variant: "default" | "success" | "warning" | "danger"
  icon: IconKey
  label: string
  reason: string
}

const REASON_KEYS: Record<DiagnosisReasonCode, string> = {
  manifestRequireAdministrator: "reasonRequireAdministrator",
  manifestHighestAvailable: "reasonHighestAvailable",
  manifestAsInvoker: "reasonAsInvoker",
  manifestUiAccess: "reasonUiAccess",
  manifestMissing: "reasonManifestMissing",
  unsupportedFile: "reasonUnsupportedFile",
  readError: "reasonReadError",
  parseError: "reasonParseError",
}

function text(i18n: Record<string, string>, key: string): string {
  return i18n[key] || ""
}

/** 诊断对象 → 标签、颜色、图标与原因文案 */
export function presentDiagnosis(
  diagnosis: PermissionDiagnosis | null | undefined,
  i18n: Record<string, string>,
): DiagnosisView {
  if (!diagnosis) {
    return {
      variant: "default",
      icon: "helpCircleOutline",
      label: text(i18n, "manifestUnknown"),
      reason: "",
    }
  }
  if (diagnosis.kind === "missing") {
    return {
      variant: "default",
      icon: "helpCircleOutline",
      label: text(i18n, "targetMissing"),
      reason: text(i18n, "reasonTargetMissing"),
    }
  }
  if (diagnosis.kind === "error") {
    return {
      variant: "default",
      icon: "helpCircleOutline",
      label: text(i18n, "diagnosisFailed"),
      reason: text(i18n, "reasonReadError"),
    }
  }

  const reason = text(i18n, REASON_KEYS[diagnosis.reasonCode])
  if (diagnosis.recommendation === "required") {
    return {
      variant: "danger",
      icon: "shieldAlert",
      label: text(i18n, "required"),
      reason,
    }
  }
  if (diagnosis.recommendation === "recommended") {
    return {
      variant: "warning",
      icon: "shield",
      label: text(i18n, "recommended"),
      reason,
    }
  }
  if (diagnosis.recommendation === "notRequired") {
    return {
      variant: "success",
      icon: "shieldCheck",
      label: text(i18n, "notRequired"),
      reason,
    }
  }
  return {
    variant: "default",
    icon: "helpCircleOutline",
    label: text(i18n, "manifestUnknown"),
    reason,
  }
}
