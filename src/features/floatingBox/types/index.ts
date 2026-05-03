/**
 * 悬浮框功能类型定义
 */

export interface FloatingTool {
  id: string;
  label: string;
  title: string;
  icon: string;
  bgColor: string;
  action: (plugin?: any) => void;
}

export interface Skill {
  id: string;
  title: string;
  description: string;
  content: string;
  content2?: string;
  content3?: string;
  category: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  color: string;
}

export interface FloatingBoxOptions {
  position?: "left" | "right";
  offset?: number;
}
