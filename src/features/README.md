# 功能模块 (Features)

本目录包含所有插件功能模块,每个功能独立组织,便于维护和扩展。

## 目录结构

```
features/
├── index.ts              # 功能模块统一导出
├── pageLock/            # 页面锁定功能
│   ├── index.ts         # 页面锁定主逻辑
│   ├── storage.ts       # 数据存储管理
│   ├── crypto.ts        # 密码加密工具
│   └── LockDialog.vue   # 锁定/解锁弹窗组件
├── tableOfContents/     # 目录功能
│   └── index.ts         # 目录功能实现
└── README.md            # 说明文档
```

## 模块说明

### pageLock (页面锁定)

**功能描述**: 对指定页面进行加密锁定,查看需要密码解锁

**主要模块**:
- `index.ts` - 功能主逻辑,菜单注册,页面拦截
- `storage.ts` - 锁定数据存储管理(基于插件存储)
- `crypto.ts` - 密码SHA-256加密/验证
- `LockDialog.vue` - 锁定/解锁弹窗组件

**主要功能**:
- 右键菜单锁定/解锁页面
- 自动拦截已锁定页面的内容显示
- 密码SHA-256加密存储
- 数据存储在插件本地存储中

**使用方式**:
```typescript
import { registerPageLock } from '@/features'

// 在插件加载时注册
registerPageLock(this)
```

**操作步骤**:
1. 在需要锁定的页面上右键,选择"锁定页面"
2. 输入密码并确认
3. 页面被锁定后,任何人打开该页面都需要输入密码
4. 要解锁页面,右键选择"解锁页面",输入密码即可

## 添加新功能模块

1. 在 `features` 目录下创建新的功能文件夹
2. 在功能文件夹中创建 `index.ts` 实现功能
3. 在 `features/index.ts` 中导出新功能
4. 在主入口 `src/index.ts` 的 `registerFeatures()` 方法中注册

**示例**:
```typescript
// features/newFeature/index.ts
export function registerNewFeature(plugin: Plugin) {
  // 实现功能逻辑
}

// features/index.ts
export { registerNewFeature } from './newFeature'

// src/index.ts
private registerFeatures() {
  registerPageLock(this)
  registerTableOfContents(this)
  registerNewFeature(this)   // 添加新功能
}
```

## 注意事项

- 每个功能模块应保持独立性
- 通过插件实例 (Plugin) 访问 i18n、eventBus 等
- 使用 TypeScript 编写,确保类型安全
- 遵循项目代码规范
