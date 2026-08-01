# DeepSeek 成本工具

DeepSeek API 成本计算与余额查询小工具，集成于工具合集底部面板。

## 功能

| 功能 | 说明 |
|------|------|
| 成本换算 | 内置 DeepSeek 官方价格表（v4-flash / v4-pro），输入命中/未命中/输出 token 数，实时计算各项费用、总费用、缓存命中率及相比全部未命中的节省金额 |
| 余额查询 | 读取超级面板配置的 DeepSeek API Key，调用官方 `/user/balance` 接口展示账户可用状态与各币种余额明细 |

## 目录结构

```
deepSeekCost/
├── index.vue              # 主容器：Tab 切换（成本换算 / 余额查询）
├── components/
│   ├── CostCalculator.vue # 成本换算面板
│   └── BalanceQuery.vue   # 余额查询面板
├── utils/
│   └── pricing.ts         # 价格常量 + 纯计算函数
└── styles/                # Codex 风格样式（共享基座 + 组件专属）
```

## 价格说明

- 数据来源：DeepSeek 官方定价页（2026-08 更新，以官网为准）
- 单位：元 / 百万 tokens
- 高峰时段（北京时间 9:00-12:00、14:00-18:00）价格为平时 2 倍，挂载时自动检测当前是否处于高峰，可手动切换

## 密钥来源

余额查询直接读取 `plugin.settings.aiApiKeys.deepseek`（超级面板 AI 设置中配置），与当前 AI 供应商无关。

## 注册说明

新增工具仅需在 `tools/registry.ts` 添加一条配置，无需修改面板容器。
