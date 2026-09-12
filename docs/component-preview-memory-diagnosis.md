# 组件预览面板 · 内存增长诊断手册

> 现象：打开组件预览页签后，内存每几秒上涨 100MB+，峰值到 1GB 以上；**关闭页签后内存恢复正常**。
> 用途：用浏览器 DevTools 一次性区分「自激循环 / DOM 节点泄漏 / 实例重复创建」三类原因，并把范围收敛到单个分区、单个示例。

---

## 一、已确认的结论（先看这里，避免重复排查）

| 结论 | 依据 |
|---|---|
| 内存由**这棵活的组件树持有**，不是「已释放但没回收」 | 关闭页签即恢复；若是跨页面全局泄漏（模块级缓存、`window`/`document` 监听器），关页也会留着 |
| **可排除**：模块级缓存泄漏（图标集合、`nodeModules` 缓存、组件内模块级 Map） | 同上 |
| **可排除**：`window` / `document` 级监听器泄漏（未清理的全局监听） | 同上 |
| **已排除的组件嫌疑** | `Loader` 是纯 CSS；`Message` / `ToastMessage` 的 `life` 定时器都有句柄 + `onBeforeUnmount` 清理；`Chart` 用的是 `vue-chartjs` 的 `<Bar>/<Line>/<Pie>/<Doughnut>` 子组件（实例生命周期由该库管理），`MutationObserver` 有 `disconnect`；`previewData/toast.ts` 的 `ToastDemo` 只是受控回写、无累积 |
| 结构背景 | 面板一次性挂载 41 个分组 × 平均 7 个示例 ≈ **290+ 个真实组件实例**（含 Chart / Sidebar / Splitter / Toast 宿主）；档位切换、搜索、滚动高亮都会让子树重渲染 |

> ⚠️ 前提校正：以上推断成立的前提是**关闭页签（同一渲染进程）**。若关闭的是「在独立窗口打开」的浮动窗口（独立渲染进程销毁），需改为**不关窗口**连续采样 60 秒。

---

## 二、三个采样脚本（依次粘贴到 DevTools Console）

打开方式：在组件预览页签上 `Ctrl+Shift+I`（或右键 → 检查）。
开始前先点一次 **Memory 面板的垃圾桶（Collect garbage）**，再执行脚本，让基线干净。

### 脚本 ①：内存 / DOM 节点 / 实例计数（每 2s 一行）

```js
// ① 内存与 DOM 采样：heap 斜率 / 节点增速 / 已实例化舞台数
(() => {
  const prev = { t: performance.now(), nodes: 0, heap: 0 };
  window.__cpMemTimer && clearInterval(window.__cpMemTimer);
  window.__cpMemTimer = setInterval(() => {
    const m = performance.memory;
    const heap = m ? m.usedJSHeapSize / 1048576 : NaN;
    const nodes = document.getElementsByTagName("*").length;
    const stages = document.querySelectorAll(".cp-card__stage").length;
    const grids = document.querySelectorAll(".cp-section__grid").length;
    const now = performance.now();
    const dt = (now - prev.t) / 1000;
    console.log(
      `[cp-mem] heap=${heap.toFixed(1)}MB (${((heap - prev.heap) / dt).toFixed(1)}MB/s)`,
      `nodes=${nodes} (${Math.round((nodes - prev.nodes) / dt)}/s)`,
      `stages=${stages} grids=${grids}`,
    );
    Object.assign(prev, { t: now, nodes, heap });
  }, 2000);
  console.log("[cp-mem] 采样中（每 2s 一行）；停止：clearInterval(window.__cpMemTimer)");
})();
```

### 脚本 ②：定时器与事件监听器净增量（每 3s 一行）

```js
// ② 定时器 / 监听器净增量（定位「持续分配」类泄漏；计数 = 创建 − 清理）
(() => {
  if (window.__cpPatched) {
    console.warn("[cp-patch] 已生效，若要重装先执行 window.__cpRestore()");
    return;
  }
  const o = {
    si: window.setInterval, ci: window.clearInterval,
    st: window.setTimeout, ct: window.clearTimeout,
    add: EventTarget.prototype.addEventListener,
    rm: EventTarget.prototype.removeEventListener,
  };
  const stat = { intervals: 0, timeouts: 0, listeners: 0 };
  window.setInterval = function (...a) { stat.intervals++; return o.si.apply(this, a); };
  window.clearInterval = function (id) { stat.intervals--; return o.ci.call(this, id); };
  window.setTimeout = function (...a) { stat.timeouts++; return o.st.apply(this, a); };
  window.clearTimeout = function (id) { stat.timeouts--; return o.ct.call(this, id); };
  EventTarget.prototype.addEventListener = function (...a) { stat.listeners++; return o.add.apply(this, a); };
  EventTarget.prototype.removeEventListener = function (...a) { stat.listeners--; return o.rm.apply(this, a); };
  const timer = setInterval(() => {
    console.log("[cp-patch] 活动 interval≈", stat.intervals, "| timeout≈", stat.timeouts, "| listener≈", stat.listeners);
  }, 3000);
  window.__cpRestore = () => {
    Object.assign(window, { setInterval: o.si, clearInterval: o.ci, setTimeout: o.st, clearTimeout: o.ct });
    EventTarget.prototype.addEventListener = o.add;
    EventTarget.prototype.removeEventListener = o.rm;
    clearInterval(timer);
    window.__cpPatched = false;
    console.log("[cp-patch] 已还原");
  };
  window.__cpPatched = true;
  console.log("[cp-patch] 生效（每 3s 一行）；还原：window.__cpRestore()");
})();
```

> 说明：`timeout` 计数含「一次性计时器到点触发但未显式 clear」的情况，故单项缓慢增长属正常；**持续单调增长**（尤其 `interval` 与 `listener`）才是可疑信号。

### 脚本 ③：DOM 变更频率（render 频率的代理指标，每 3s 一行）

```js
// ③ DOM 变更频率：整页每秒被改写的次数 —— 数值居高不下说明存在高频重渲染
(() => {
  window.__cpMutTimer && clearInterval(window.__cpMutTimer);
  window.__cpMutations && window.__cpMutations.disconnect();
  let count = 0;
  window.__cpMutations = new MutationObserver(() => { count++; });
  window.__cpMutations.observe(document.body, {
    childList: true, subtree: true, attributes: true, characterData: true,
  });
  window.__cpMutTimer = setInterval(() => {
    console.log("[cp-mut] 近 3s DOM 变更次数 =", count, `(${(count / 3).toFixed(0)}/s)`);
    count = 0;
  }, 3000);
  console.log("[cp-mut] 采样中；停止：clearInterval(window.__cpMutTimer); window.__cpMutations.disconnect()");
})();
```

---

## 三、判定树（三个读数组合直接给结论）

| 读数组合 | 结论 | 下一步 |
|---|---|---|
| heap 涨，**nodes 与 stages 都稳定**，`cp-mut` 数值很高（>50/s） | **自激循环 / 高频重渲染**：`emit → 写回 modelValue → 重渲染 → 再 emit` 或某组件按帧改状态 | 走第四节的二分法；命中后检查该组件是否「挂载/监听里无条件回写」 |
| heap 涨，**nodes 同步涨**（`/s` 明显 > 0），stages 稳定 | **DOM 节点泄漏**：某处 append 后未回收 | DevTools Elements 面板看新增节点挂在哪个组件下，再去该组件找 `appendChild` / `Teleport` / 动态插入 |
| heap 涨，**stages 同步涨** | **实例被反复创建且旧实例仍被引用** | 检查该分区的 `v-for` key、示例数组是否被重建/累积 |
| heap 进入平台期（斜率趋近 0），三个读数都平稳 | 一次性的挂载开销，非泄漏 | 无需处理；若基线本身过高，看 stages 数是否已随懒挂载降到 < 40 |
| `cp-patch` 的 `interval` 或 `listener` 单调增长 | 定时器 / 监听器未清理 | 用二分法定位到分区后，检查该组件 `onBeforeUnmount` 清理路径 |

---

## 四、四步二分法（把范围收敛到单个示例）

前提：能改代码并重新构建（开发模式下 `pnpm dev` 会热重载）。

1. **整页确认**：保持面板打开 **60 秒**，用脚本 ①②③ 记录基线、30s、60s 三组读数（模板见第五节）。
2. **切半分**：编辑 `src/features/componentPreview/previewData/index.ts` 的 `PREVIEW_GROUPS`，只保留**前一半**数据文件（注释掉其余 `...xxxPreviewGroups,`），重载预览面板，重复第 1 步。
   - 仍增长 ⇒ 问题在前一半；不增长 ⇒ 在后一半。继续对半切，直到锁定**单个分区**。
3. **分区内对半**：把该分区 `examples` 数组里的示例对半注释掉，重复采样，锁定**单个示例**。
4. **组件级排查**：在锁定的示例对应的组件源码里依次检查：
   - `watch(..., { immediate: true })` / `onMounted` 里是否有**无条件 `emit`**（尤其回写新数组 / 新对象）
   - `setInterval` / `setTimeout` / `requestAnimationFrame` 是否都在 `onBeforeUnmount` 清理
   - `addEventListener` / `Observer` 是否成对清理
   - 是否有 DOM `appendChild` / `Teleport` 未回收

> 提示：本轮已加入**懒挂载 + 远区卸载**（`index.vue` 的 IntersectionObserver，`rootMargin: 800px`）。若改后仍持续增长，说明是真泄漏（而非"挂载量太大"），请务必回传第四节第 1 步的读数，据此做定点修复。

---

## 五、需要回传的内容（复制这段填好发回）

```
环境：页签 / 独立窗口（二选一）
heap：基线 ____MB → 30s ____MB → 60s ____MB（斜率 ____MB/s）
nodes：基线 ____ → 60s ____（增速 ____/s）
stages：____ 个（懒挂载后应 < 40）
cp-patch：interval ____ → ____ ｜ timeout ____ → ____ ｜ listener ____ → ____
cp-mut：近 3s DOM 变更次数 ____ / ____ / ____
命中的现象：A 自激循环 / B DOM 节点泄漏 / C 实例重复创建 / D 平台期（非泄漏）
（若已二分）定位到的分区：____ ｜ 示例：____
```

---

## 六、已知的止血手段（本轮已落地）

| 手段 | 位置 | 作用 |
|---|---|---|
| 分区懒挂载 + 远区卸载 | `index.vue`（IntersectionObserver，`rootMargin: 800px`，离开 400ms 后卸载） | 常驻实例从 ~290 降到约 20-40，给内存一个硬上限 |
| 高度占位 | `PreviewSection.vue` 的 `.cp-section__placeholder`（父级记录网格实测高度） | 卸载后不跳动、滚动位置稳定 |
| props 单次解析 | `PreviewCard.vue` 的 `resolvedProps` computed | 消除每帧 2×N 次对象分配（组件本体与复合示例共用同一对象） |
| modelValue 同值守卫 | `components/PreviewStage.ts` 的 `isSameValue` | 截断 `emit → 写回 → 重渲染 → 再 emit` 自激循环（数组按内容浅比较） |
