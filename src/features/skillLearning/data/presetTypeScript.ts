/**
 * 技能学习 - 内置预设卡片数据（TypeScript 5 张）
 */
import type { CreateSkillDTO } from "../types"

export const PRESET_CARDS_TYPESCRIPT: CreateSkillDTO[] = [
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
]
