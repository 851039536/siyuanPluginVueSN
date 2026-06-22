/**
 * 技能学习功能 - 内置预设卡片数据（C# / JS / TS / Vue 各 5 张入门卡片）
 */
import type { CreateSkillDTO } from "../types"

export const PRESET_CARDS: CreateSkillDTO[] = [
  // ========== C# ==========
  {
    title: "C# 中的 async/await 是如何工作的？",
    answer: "async/await 是 C# 异步编程的核心语法糖。async 标记方法为异步，await 暂停方法执行直到任务完成，不会阻塞线程。编译器将 async 方法转换为状态机。",
    distractors: [
      "async/await 会创建新的线程来执行异步代码",
      "await 关键字会阻塞当前线程直到任务完成",
      "async 方法必须返回 void 类型",
    ],
    codeSnippet:
      'public async Task<string> FetchDataAsync()\n{\n    using var client = new HttpClient();\n    var result = await client.GetStringAsync("https://api.example.com");\n    return result;\n}',
    language: "csharp",
    category: "异步编程",
    difficulty: "intermediate",
    tags: ["async", "await", "Task"],
  },
  {
    title: "C# 中 class 和 struct 的区别是什么？",
    answer: "class 是引用类型，分配在堆上，通过引用传递；struct 是值类型，分配在栈上，通过值复制传递。struct 不能继承，适合小型数据结构。",
    distractors: [
      "class 和 struct 都是引用类型，没有本质区别",
      "struct 可以继承其他 struct 或 class",
      "class 只能分配在栈上",
    ],
    codeSnippet:
      "class Person { public string Name; }\nstruct Point { public int X; public int Y; }\n\nvar p1 = new Person { Name = \"Alice\" };\nvar p2 = p1; // 引用复制，指向同一对象\n\nvar pt1 = new Point { X = 1, Y = 2 };\nvar pt2 = pt1; // 值复制，独立副本",
    language: "csharp",
    category: "基础语法",
    difficulty: "beginner",
    tags: ["class", "struct", "值类型", "引用类型"],
  },
  {
    title: "C# 的 LINQ 是什么？有哪些常用方法？",
    answer: "LINQ（Language Integrated Query）是 C# 的查询语法，用于对集合进行过滤、排序、投影等操作。常用方法：Where、Select、OrderBy、GroupBy、FirstOrDefault。",
    distractors: [
      "LINQ 是 C# 的数据库连接驱动",
      "LINQ 只能用于查询 SQL 数据库",
      "LINQ 方法会直接修改原集合",
    ],
    codeSnippet:
      "var numbers = new[] { 1, 2, 3, 4, 5, 6 };\nvar evenNumbers = numbers\n    .Where(n => n % 2 == 0)\n    .OrderByDescending(n => n)\n    .Select(n => n * 10);\n// 结果: [60, 40, 20]",
    language: "csharp",
    category: "集合操作",
    difficulty: "beginner",
    tags: ["LINQ", "Lambda", "集合"],
  },
  {
    title: "C# 接口 (interface) 和抽象类 (abstract class) 的区别？",
    answer: "接口定义契约，只能包含方法签名和属性，支持多实现；抽象类可以包含实现代码和字段，只能单继承。C# 8+ 接口支持默认实现。",
    distractors: [
      "接口可以包含字段和构造函数",
      "抽象类支持多继承，可以同时继承多个抽象类",
      "接口和抽象类都不能包含任何实现代码",
    ],
    codeSnippet:
      "interface ILogger\n{\n    void Log(string message);\n    void LogError(string error) => Log($\"ERROR: {error}\"); // C# 8 默认实现\n}\n\nabstract class BaseService\n{\n    protected string Name { get; set; }\n    public abstract void Execute();\n    public virtual void Initialize() => Console.WriteLine(\"Init\");\n}",
    language: "csharp",
    category: "面向对象",
    difficulty: "intermediate",
    tags: ["interface", "abstract", "OOP"],
  },
  {
    title: "C# 的依赖注入 (DI) 模式是什么？",
    answer: "依赖注入是将对象的依赖交给外部容器管理，而不是在类内部 new。ASP.NET Core 内置 DI 容器，支持 Singleton、Scoped、Transient 三种生命周期。",
    distractors: [
      "依赖注入只能通过构造函数参数实现",
      "Singleton 生命周期意味着每次请求创建新实例",
      "依赖注入只是为了方便单元测试，没有其他用途",
    ],
    codeSnippet:
      "// 注册服务\nbuilder.Services.AddScoped<IUserService, UserService>();\nbuilder.Services.AddSingleton<ICacheService, RedisCacheService>();\n\n// 使用注入\npublic class UserController : ControllerBase\n{\n    private readonly IUserService _userService;\n    public UserController(IUserService userService)\n    {\n        _userService = userService;\n    }\n}",
    language: "csharp",
    category: "设计模式",
    difficulty: "advanced",
    tags: ["DI", "依赖注入", "IoC"],
  },

  // ========== JavaScript ==========
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

  // ========== TypeScript ==========
  {
    title: "TypeScript 的泛型 (Generics) 如何使用？",
    answer: "泛型让函数、接口、类能够处理多种类型而不丢失类型信息。通过 <T> 占位符定义，调用时自动推断或显式指定。",
    distractors: [
      "泛型只能在 TypeScript 的 class 中使用",
      "泛型变量 T 的类型在运行时动态确定",
      "泛型会降低 TypeScript 的类型安全性",
    ],
    codeSnippet:
      "function identity<T>(arg: T): T {\n  return arg;\n}\n\nidentity<string>('hello'); // 显式指定\nidentity(42);              // 自动推断为 number\n\ninterface ApiResponse<T> {\n  data: T;\n  status: number;\n  message: string;\n}\n\ntype UserResponse = ApiResponse<{ id: number; name: string }>;",
    language: "typescript",
    category: "类型系统",
    difficulty: "intermediate",
    tags: ["泛型", "Generics", "类型"],
  },
  {
    title: "TypeScript 中 type 和 interface 的区别？",
    answer: "interface 支持声明合并（可扩展），type 支持联合类型和交叉类型。对象形状优先用 interface，需要联合/元组/映射类型时用 type。",
    distractors: [
      "type 支持声明合并，interface 不支持",
      "interface 可以用来定义联合类型",
      "type 和 interface 功能完全相同，只是写法不同",
    ],
    codeSnippet:
      "// interface 声明合并\ninterface User { name: string; }\ninterface User { age: number; }\n// User 现在有 name 和 age\n\n// type 联合类型\ntype Status = 'active' | 'inactive' | 'pending';\ntype StringOrNumber = string | number;\n\n// type 交叉类型\ntype Admin = User & { role: 'admin' };",
    language: "typescript",
    category: "类型系统",
    difficulty: "beginner",
    tags: ["type", "interface", "类型系统"],
  },
  {
    title: "TypeScript 的工具类型 (Utility Types) 有哪些常用？",
    answer: "Partial<T> 所有属性可选，Required<T> 所有属性必需，Pick<T,K> 选取部分属性，Omit<T,K> 排除部分属性，Record<K,V> 构建键值对类型。",
    distractors: [
      "Partial<T> 会让所有属性变成只读",
      "Pick<T,K> 用于从类型中排除指定属性",
      "Record<K,V> 用于定义数组类型",
    ],
    codeSnippet:
      "interface User {\n  id: number;\n  name: string;\n  email: string;\n  password: string;\n}\n\ntype PartialUser = Partial<User>;      // 所有属性可选\ntype UserPreview = Pick<User, 'id' | 'name'>; // 只选 id 和 name\ntype UserWithoutPassword = Omit<User, 'password'>; // 排除 password\ntype UserMap = Record<string, User>;   // { [key: string]: User }",
    language: "typescript",
    category: "类型系统",
    difficulty: "intermediate",
    tags: ["Utility Types", "工具类型"],
  },
  {
    title: "TypeScript 的枚举 (enum) vs 联合类型 (union) ？",
    answer: "枚举生成运行时对象（双向映射），联合类型仅编译时存在。现代 TS 推荐使用 const enum 或 string literal union 以获得更小的编译输出。",
    distractors: [
      "enum 在编译后完全不产生任何 JavaScript 代码",
      "联合类型会产生运行时对象进行映射",
      "枚举不能用于 switch 语句",
    ],
    codeSnippet:
      "// 枚举（有运行时开销）\nenum Direction {\n  Up = 'UP',\n  Down = 'DOWN',\n}\n\n// 推荐：字符串字面量联合类型\nconst DIRECTIONS = ['UP', 'DOWN'] as const;\ntype Direction = (typeof DIRECTIONS)[number];\n\n// 或\nfunction move(direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT') {\n  // ...\n}",
    language: "typescript",
    category: "类型系统",
    difficulty: "beginner",
    tags: ["enum", "union", "类型"],
  },
  {
    title: "TypeScript 中 declare 关键字的作用？",
    answer: "declare 用于声明全局变量、模块、类型，告诉 TS 编译器这些实体存在但不产生编译输出。常用于 .d.ts 声明文件。",
    distractors: [
      "declare 关键字会生成对应的 JavaScript 代码",
      "declare 只能在 .ts 文件中使用，不能用于 .d.ts",
      "declare 用于定义私有属性和方法",
    ],
    codeSnippet:
      "// 声明全局变量（来自外部 script 标签）\ndeclare const jQuery: (selector: string) => any;\n\n// 声明模块\ndeclare module '*.vue' {\n  import type { DefineComponent } from 'vue';\n  const component: DefineComponent<{}, {}, any>;\n  export default component;\n}\n\n// 声明全局函数\ndeclare function gtag(event: string, params: Record<string, any>): void;",
    language: "typescript",
    category: "基础语法",
    difficulty: "intermediate",
    tags: ["declare", ".d.ts", "声明"],
  },

  // ========== Vue ==========
  {
    title: "Vue 3 Composition API 中 ref 和 reactive 的区别？",
    answer: "ref 用于基本类型和任意值，需要 .value 访问；reactive 用于对象类型，直接访问属性无需 .value。ref 在模板中会自动解包。",
    distractors: [
      "ref 和 reactive 完全相同，没有任何区别",
      "reactive 在模板中也需要 .value 访问",
      "ref 只能用于对象，reactive 只能用于基本类型",
    ],
    codeSnippet:
      "import { ref, reactive } from 'vue';\n\n// ref - 基本类型\nconst count = ref(0);\nconsole.log(count.value); // 0\n\n// reactive - 对象\nconst state = reactive({\n  user: { name: 'Alice' },\n  items: [],\n});\nstate.user.name = 'Bob'; // 直接访问\n\n// 模板中 ref 自动解包\n// <span>{{ count }}</span> 而非 count.value",
    language: "vue",
    category: "Composition API",
    difficulty: "beginner",
    tags: ["ref", "reactive", "响应式"],
  },
  {
    title: "Vue 3 的 computed 和 watch 有什么区别？",
    answer: "computed 用于派生状态（有缓存，依赖变化才重算），watch 用于监听变化并执行副作用（如 API 调用、DOM 操作）。",
    distractors: [
      "computed 没有缓存，每次访问都重新计算",
      "watch 会自动缓存计算结果",
      "computed 可以直接执行异步操作",
    ],
    codeSnippet:
      "import { ref, computed, watch } from 'vue';\n\nconst firstName = ref('John');\nconst lastName = ref('Doe');\n\n// computed - 派生状态，有缓存\nconst fullName = computed(() => `${firstName.value} ${lastName.value}`);\n\n// watch - 执行副作用\nwatch([firstName, lastName], ([newFirst, newLast]) => {\n  console.log(`Name changed to: ${newFirst} ${newLast}`);\n  saveToLocalStorage({ first: newFirst, last: newLast });\n});",
    language: "vue",
    category: "Composition API",
    difficulty: "beginner",
    tags: ["computed", "watch", "响应式"],
  },
  {
    title: "Vue 3 的生命周期钩子有哪些？",
    answer: "setup 替代 beforeCreate/created。常用：onMounted、onUpdated、onUnmounted。调试用：onBeforeMount、onBeforeUpdate、onBeforeUnmount。",
    distractors: [
      "Vue 3 中 beforeCreate 和 created 仍然是最常用的钩子",
      "onMounted 在组件创建之前执行",
      "onUnmounted 会在组件更新时触发",
    ],
    codeSnippet:
      "import { onMounted, onUnmounted, onUpdated } from 'vue';\n\nexport default {\n  setup() {\n    onMounted(() => {\n      console.log('组件已挂载');\n      fetchData();\n    });\n\n    onUpdated(() => {\n      console.log('组件已更新');\n    });\n\n    onUnmounted(() => {\n      console.log('组件即将卸载');\n      clearInterval(timer);\n    });\n  },\n};",
    language: "vue",
    category: "组件基础",
    difficulty: "beginner",
    tags: ["生命周期", "hooks"],
  },
  {
    title: "Vue 中 v-if 和 v-show 的区别？",
    answer: "v-if 条件为假时元素不会渲染到 DOM（有切换开销），v-show 始终渲染但通过 CSS display 控制可见性（有初始渲染开销）。频繁切换用 v-show，条件很少改变用 v-if。",
    distractors: [
      "v-show 在条件为假时会完全移除 DOM 元素",
      "v-if 性能始终优于 v-show，无论使用场景",
      "v-show 支持 v-else，v-if 不支持",
    ],
    codeSnippet:
      '<!-- v-if: 条件假时 DOM 不存在 -->\n<div v-if="isLoggedIn">欢迎回来，用户！</div>\n<div v-else>请先登录</div>\n\n<!-- v-show: 始终渲染，通过 display 切换 -->\n<div v-show="isModalOpen">\n  <Modal />\n</div>\n\n<!-- 建议：频繁切换用 v-show，一次性判断用 v-if -->',
    language: "vue",
    category: "模板语法",
    difficulty: "beginner",
    tags: ["v-if", "v-show", "指令"],
  },
  {
    title: "Vue 3 的 Teleport 组件有什么用？",
    answer: "Teleport 将组件内容渲染到 DOM 中指定的目标元素下（如 body 末尾），常用于模态框、通知、下拉菜单等需要脱离组件层级约束的场景。",
    distractors: [
      "Teleport 用于在组件间传递数据，类似 props",
      "Teleport 可以让组件内容在多个位置同时渲染",
      "Teleport 是 Vue Router 的功能，用于页面跳转",
    ],
    codeSnippet:
      '<!-- Modal.vue -->\n<template>\n  <Teleport to="body">\n    <div class="modal-overlay" @click.self="$emit(\'close\')">\n      <div class="modal-content">\n        <h2>{{ title }}</h2>\n        <slot />\n        <button @click="$emit(\'close\')">关闭</button>\n      </div>\n    </div>\n  </Teleport>\n</template>\n<!-- 渲染后 modal 出现在 <body> 末尾，不受父组件 overflow/层级影响 -->',
    language: "vue",
    category: "组件进阶",
    difficulty: "intermediate",
    tags: ["Teleport", "模态框", "Portal"],
  },
]
