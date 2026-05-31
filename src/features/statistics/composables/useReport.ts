import type {
  ChangedDoc,
  NotebookActivityItem,
  ReportData,
  TrendPrediction,
} from "../types"
import {
  getDateChangedDocs,
  getDateRangeChangeStats,
} from "../queries/docChangeStats"
import { getNotebookActivityTrend } from "../queries/notebookStats"
import {
  getReportData,
  getTrendPrediction,
} from "../queries/reportStats"

export function useReport(): {
  getDateChangedDocs: (dateStr: string) => Promise<{ newDocs: ChangedDoc[], modifiedDocs: ChangedDoc[] }>
  getDateRangeChangeStats: (startStr: string, endStr: string) => Promise<Array<{ date: string, newCount: number, modifiedCount: number }>>
  getNotebookActivityTrend: (days: number) => Promise<NotebookActivityItem[]>
  getReportData: (year?: number, month?: number) => Promise<ReportData>
  getTrendPrediction: () => Promise<TrendPrediction>
} {
  return {
    getDateChangedDocs,
    getDateRangeChangeStats,
    getNotebookActivityTrend,
    getReportData,
    getTrendPrediction,
  }
}
