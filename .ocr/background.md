本次提交为思源笔记插件接入 SQLite 统一单库存储：
1. 新增 src/utils/sqliteDb.ts —— 封装思源 Electron 内置的 node:sqlite（Electron 44/Node 24 起稳定），
   负责绝对路径解析（plugin.dataDir 运行时为 undefined，必须回退到 window.siyuan.config 或 /api/system/getConf）、
   启动早期 6 次退避重试、WAL 模式、user_version 迁移、snapshotTo 在线备份、featureTables 表名前缀。
2. 全插件统一单库 plugin.db，按表名前缀隔离（wn_entries / wn_categories），禁止按功能建库。
3. 网站导航与极简浏览器书签改为共享同一 SQLite 存储（模块级单例 getSharedWebsiteStorage），
   纯 SQLite 无 JSON 回退；移除 WebsiteNavigationStorage 里的 TypedStorage/PluginStorage 依赖。
4. registerFeature 中预热（非阻塞），destroy 时 closeSharedWebsiteStorage 释放连接。
5. settingsBackup.ts 增加备份前 WAL checkpoint 与恢复时附属文件处理，避免 WAL 模式下单独复制 .db 得到空库。
6. 运行时只建表，不做历史数据迁移（迁移已由一次性脚本完成并删除）。
已知历史坑：路径若为相对路径会把库建到渲染进程 CWD；WAL 下单独复制 .db 会丢数据。
