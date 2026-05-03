/// <reference types="vite/client" />

// 声明 .md?raw 导入类型
declare module "*.md?raw" {
  const content: string;
  export default content;
}

// 声明 .md 导入类型
declare module "*.md" {
  const content: string;
  export default content;
}
