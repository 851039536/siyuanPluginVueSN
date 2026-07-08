---
name: fix-unitconverter-logic-bugs
overview: 修复 unitConverter 模块发现的 2 个转换逻辑 Bug：BaseConverter 拒绝负数输入、BaseUnitConverter 空输入显示 "0"
todos:
  - id: fix-base-negative
    content: 修复 BaseConverter.vue isValidInput 支持负数输入（允许首位可选 - 符号）
    status: completed
  - id: fix-unit-empty-input
    content: 修复 BaseUnitConverter.vue 空输入时 result 返回空字符串而非 "0"
    status: completed
  - id: verify-memory
    content: 更新 MEMORY.md 记录本次修复
    status: completed
    dependencies:
      - fix-base-negative
      - fix-unit-empty-input
---

## 修复内容

修复 unitConverter 模块中上一轮审查发现的两处转换逻辑错误：

### Bug 1: 进制转换器拒绝负数输入

- **位置**: `BaseConverter.vue` 的 `isValidInput` 函数
- **现象**: 输入 `-10`（十进制）时显示"无效的10进制输入"
- **根因**: `isValidInput` 逐字符校验时，`-` 不在任何进制的有效字符集中
- **修复**: 允许输入首位可选 `-` 符号，其他位置不允许

### Bug 2: 物理单位转换器空输入显示 "0"

- **位置**: `BaseUnitConverter.vue` 的 `convertToUnit` 函数
- **现象**: 清空输入框后显示"0 m = 0 cm"，用户困惑
- **根因**: `NaN` 输入时 `convertToUnit` 返回字符串 `"0"`，`"0"` 为 truthy 导致 `v-if="result"` 仍然渲染
- **修复**: `NaN` 时返回空字符串，`result` computed 在无有效输入时为空

## 技术方案

### Bug 1 修复方案

修改 `BaseConverter.vue` 中的 `isValidInput` 函数：

```
当前逻辑：
function isValidInput(value, base):
  for each char in value.toUpperCase():
    if char not in VALID_CHARS_MAP[base] → return false
  return true

修复后逻辑：
function isValidInput(value, base):
  startIndex = (value[0] === '-') ? 1 : 0
  for i = startIndex to value.length:
    if value[i].toUpperCase() not in VALID_CHARS_MAP[base] → return false
  return true（且 value 非空、非仅 "-"）
```

关键处理：

- 允许首位 `-` 跳过字符集校验
- `"-"` 单独输入不合法（没有数字部分）
- 正值不受影响

### Bug 2 修复方案

修改 `BaseUnitConverter.vue` 中的 `result` computed：

```
当前逻辑：
result = computed(() => convertToUnit(toUnit.value))
// convertToUnit 对 NaN 返回 "0"

修复后逻辑：
result = computed(() => {
  const value = parseFloat(inputValue.value)
  if (isNaN(value) || inputValue.value === "") return ""
  return convertToUnit(toUnit.value)
})
```

或者修改 `convertToUnit` 函数，将 `return "0"` 改为 `return ""`，但这样会影响 Quick Reference 区域的调用。更好的做法是在 `result` computed 中提前判断，保持 `convertToUnit` 的纯粹性。

### 影响范围

- 仅修改 2 个文件，改动量极小
- 不涉及样式、类型定义、其他组件
- 不影响现有功能逻辑