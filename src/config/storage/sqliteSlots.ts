/**
 * 存储槽注册表 - SQLite 表
 *
 * 全部位于唯一 plugin.db；表名由 featureTables() 生成，保持 `<前缀>_<实体>`。
 */
import { sqliteSlot } from "./helpers"

export const SQLITE_SLOTS = [
  sqliteSlot("websiteNavigation.entries", ["websiteNavigation", "minimalBrowser"], "wn_entries", "网站导航条目", {
    notes: "书签条目；minimalBrowser 共享读取",
  }),
  sqliteSlot("websiteNavigation.categories", ["websiteNavigation", "minimalBrowser"], "wn_categories", "网站导航分类", {
    notes: "空库时播种默认分类",
  }),
  sqliteSlot("everythingSearch.cleanHistory", ["everythingSearch"], "es_clean_history", "缓存清理历史", {
    notes: "上限 500 行，时间索引",
  }),
  sqliteSlot("s3FileManager.logs", ["s3FileManager"], "s3fm_logs", "S3 文件操作日志", {
    notes: "上限 200 行",
  }),
  sqliteSlot("gitPush.projectStats", ["gitPush"], "gp_project_stats", "Git 项目行数统计"),
  sqliteSlot("gitPush.fileLines", ["gitPush"], "gp_file_lines", "Git 文件行数明细", {
    notes: "主键 (project_id, path)",
  }),
] as const
