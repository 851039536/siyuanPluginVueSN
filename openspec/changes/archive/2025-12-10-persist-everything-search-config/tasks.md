## 1. 实施准备
- [x] 1.1 分析当前EverythingSearchDialog.vue中的配置存储逻辑
- [x] 1.2 查看其他模块如何使用plugin.saveData/loadData模式作为参考
- [x] 1.3 确定配置数据的唯一key名称（如"everything-search-config"）

## 2. 实施配置存储迁移
- [x] 2.1 在EverythingSearchDialog.vue中添加loadConfigFromPlugin函数
- [x] 2.2 在EverythingSearchDialog.vue中添加saveConfigToPlugin函数
- [x] 2.3 实现从localStorage到plugin存储的迁移逻辑
- [x] 2.4 修改loadConfig函数以优先使用plugin存储，并回退到localStorage进行迁移
- [x] 2.5 修改saveConfig函数以使用plugin.saveData替代localStorage

## 3. 验证和测试
- [x] 3.1 测试新配置的保存和加载
- [x] 3.2 验证从localStorage的迁移是否正常工作
- [x] 3.3 测试配置在插件重启后是否持久化
- [x] 3.4 确保UI和用户交互保持不变

## 4. 清理
- [x] 4.1 移除不再需要的localStorage相关代码（在迁移完成后）
- [x] 4.2 添加适当的注释说明配置存储机制