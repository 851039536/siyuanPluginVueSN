/**
 * 技能学习 - 内置预设卡片数据（C# 5 张）
 */
import type { CreateSkillDTO } from "../types"

export const PRESET_CARDS_CSHARP: CreateSkillDTO[] = [
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
]
