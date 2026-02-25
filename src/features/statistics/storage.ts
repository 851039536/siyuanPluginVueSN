/**
 * 统计数据缓存存储
 */

import { Plugin } from 'siyuan';

/**
 * 统计快照接口
 */
export interface StatisticsSnapshot {
  timestamp: number;           // 时间戳
  datetime: string;            // 格式化时间
  totalNotes: number;          // 总笔记数
  totalWords: number;          // 总字数
  totalBlocks: number;         // 总块数
  totalAssets: number;         // 总附件数
  totalImages: number;         // 总图片数
  totalTags: number;           // 总标签数
  totalBacklinks: number;      // 总双链数
  todayCreated: number;        // 今日新增
  todayModified: number;       // 今日修改
  avgWordsPerDoc: number;      // 平均字数
}

/**
 * 统计缓存管理器
 */
export class StatisticsCache {
  private plugin: Plugin;
  private readonly CACHE_KEY = 'statistics-snapshots';
  private readonly MAX_SNAPSHOTS = 100; // 最多保留100个快照

  constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * 添加统计快照
   */
  async addSnapshot(snapshot: Omit<StatisticsSnapshot, 'datetime'>): Promise<void> {
    try {
      const snapshots = await this.loadSnapshots();

      // 添加格式化时间
      const fullSnapshot: StatisticsSnapshot = {
        ...snapshot,
        datetime: new Date(snapshot.timestamp).toLocaleString('zh-CN')
      };

      // 添加到数组开头（最新的在前面）
      snapshots.unshift(fullSnapshot);

      // 只保留最近的快照
      if (snapshots.length > this.MAX_SNAPSHOTS) {
        snapshots.splice(this.MAX_SNAPSHOTS);
      }

      await this.plugin.saveData(this.CACHE_KEY, snapshots);
    } catch (error) {
      console.error('保存统计快照失败:', error);
    }
  }

  /**
   * 加载所有快照
   */
  async loadSnapshots(): Promise<StatisticsSnapshot[]> {
    try {
      const data = await this.plugin.loadData(this.CACHE_KEY);
      return data || [];
    } catch (error) {
      console.error('加载统计快照失败:', error);
      return [];
    }
  }

  /**
   * 获取最近N个快照
   */
  async getRecentSnapshots(count: number = 20): Promise<StatisticsSnapshot[]> {
    const snapshots = await this.loadSnapshots();
    return snapshots.slice(0, count);
  }

  /**
   * 清除所有快照
   */
  async clearSnapshots(): Promise<void> {
    try {
      await this.plugin.saveData(this.CACHE_KEY, []);
    } catch (error) {
      console.error('清除统计快照失败:', error);
    }
  }

  /**
   * 获取快照统计信息
   */
  async getSnapshotStats(): Promise<{
    count: number;
    oldest?: string;
    newest?: string;
  }> {
    const snapshots = await this.loadSnapshots();
    return {
      count: snapshots.length,
      oldest: snapshots.length > 0 ? snapshots[snapshots.length - 1].datetime : undefined,
      newest: snapshots.length > 0 ? snapshots[0].datetime : undefined,
    };
  }
}
