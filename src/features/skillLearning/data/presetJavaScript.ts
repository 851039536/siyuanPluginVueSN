/**
 * 技能学习 - 内置预设卡片数据（JavaScript 5 张）
 */
import type { CreateSkillDTO } from "../types"

export const PRESET_CARDS_JAVASCRIPT: CreateSkillDTO[] = [
  {
    title: "JavaScript 的闭包 (Closure) 是什么？",
    answer: "闭包是指函数能够记住并访问其词法作用域的能力，即使该函数在其词法作用域之外执行。常用于数据封装和模块模式。",
    distractors: [
      "闭包是 JavaScript 的垃圾回收机制",
      "闭包只能通过箭头函数创建",
      "闭包会导致所有外部变量被立即释放",
    ],
    codeSnippet:
      "function createCounter() {\n  let count = 0;\n  return {\n    increment: () => ++count,\n    decrement: () => --count,\n    getCount: () => count,\n  };\n}\n\nconst counter = createCounter();\ncounter.increment(); // 1\ncounter.increment(); // 2\ncounter.getCount();  // 2",
    language: "javascript",
    category: "核心概念",
    difficulty: "intermediate",
    tags: ["closure", "闭包", "作用域"],
  },
  {
    title: "Promise 和 async/await 有什么关系？",
    answer: "async/await 是 Promise 的语法糖，让异步代码读起来像同步代码。async 函数始终返回 Promise，await 暂停执行直到 Promise 完成。",
    distractors: [
      "async/await 完全替代了 Promise，两者不能混用",
      "await 只能用于调用同步函数",
      "Promise 是 async/await 的底层线程池实现",
    ],
    codeSnippet:
      "// Promise 写法\nfetch('/api/data')\n  .then(res => res.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));\n\n// async/await 写法\nasync function fetchData() {\n  try {\n    const res = await fetch('/api/data');\n    const data = await res.json();\n    console.log(data);\n  } catch (err) {\n    console.error(err);\n  }\n}",
    language: "javascript",
    category: "异步编程",
    difficulty: "beginner",
    tags: ["Promise", "async", "await"],
  },
  {
    title: "JavaScript 中 == 和 === 的区别？",
    answer: "== 是宽松相等（会进行类型转换），=== 是严格相等（类型和值都必须相同）。推荐始终使用 === 以避免意外的类型转换问题。",
    distractors: [
      "== 比较值和类型，=== 只比较值",
      "== 的性能比 === 更高，推荐使用 ==",
      "=== 会尝试类型转换后再比较",
    ],
    codeSnippet:
      '0 == false    // true  (类型转换)\n0 === false   // false (类型不同)\n"" == false   // true\n"" === false  // false\nnull == undefined  // true\nnull === undefined // false\n\n// 最佳实践：始终使用 ===',
    language: "javascript",
    category: "基础语法",
    difficulty: "beginner",
    tags: ["相等", "类型转换"],
  },
  {
    title: "什么是事件委托 (Event Delegation)？",
    answer: "事件委托利用事件冒泡，将事件监听器绑定在父元素上，通过 event.target 判断实际点击的元素。减少内存消耗，支持动态添加元素。",
    distractors: [
      "事件委托是指将事件处理函数委托给 Web Worker 执行",
      "事件委托要求每个子元素都绑定独立的监听器",
      "事件委托利用了事件捕获阶段而非冒泡阶段",
    ],
    codeSnippet:
      "// 不推荐：为每个 li 绑定事件\ndocument.querySelectorAll('li').forEach(li => {\n  li.addEventListener('click', handleClick);\n});\n\n// 推荐：事件委托\ndocument.querySelector('ul').addEventListener('click', (e) => {\n  if (e.target.tagName === 'LI') {\n    console.log('Clicked:', e.target.textContent);\n  }\n});",
    language: "javascript",
    category: "DOM 操作",
    difficulty: "intermediate",
    tags: ["事件委托", "冒泡", "DOM"],
  },
  {
    title: "防抖 (Debounce) 和节流 (Throttle) 的区别和应用场景？",
    answer: "防抖：延迟执行，在连续触发时只执行最后一次（如搜索框输入）。节流：固定频率执行，在一段时间内只执行一次（如滚动事件）。",
    distractors: [
      "防抖适合滚动事件，节流适合搜索输入",
      "防抖和节流效果完全相同，只是实现方式不同",
      "防抖会让函数立即执行第一次然后忽略后续调用",
    ],
    codeSnippet:
      "function debounce(fn, delay) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}\n\nfunction throttle(fn, limit) {\n  let inThrottle;\n  return function(...args) {\n    if (!inThrottle) {\n      fn.apply(this, args);\n      inThrottle = true;\n      setTimeout(() => inThrottle = false, limit);\n    }\n  };\n}",
    language: "javascript",
    category: "性能优化",
    difficulty: "intermediate",
    tags: ["防抖", "节流", "性能"],
  },
]
