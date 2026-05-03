/**
 * 单位转换器工具函数
 */

/**
 * 单位定义接口
 */
export interface UnitDefinition {
  key: string;
  name: string;
  symbol: string;
  factor: number;
}

/**
 * 格式化转换结果
 * 优化：减少条件判断层级，提前返回
 */
export function formatResult(value: number): string {
  if (value === 0) return "0";

  const absValue = Math.abs(value);

  if (absValue < 0.000001) return value.toExponential(6);
  if (absValue < 0.01) return value.toFixed(8);
  if (absValue < 1) return value.toFixed(6);
  if (absValue > 1000000) return value.toExponential(6);

  return value.toFixed(6).replace(/\.?0+$/, "");
}

/**
 * 获取单位因子
 * 优化：使用 Map 缓存提升查找性能
 */
export function createUnitLookup(units: UnitDefinition[]) {
  const factorMap = new Map<string, number>();
  const symbolMap = new Map<string, string>();

  units.forEach((unit) => {
    factorMap.set(unit.key, unit.factor);
    symbolMap.set(unit.key, unit.symbol);
  });

  return {
    getFactor: (key: string): number => factorMap.get(key) ?? 1,
    getSymbol: (key: string): string => symbolMap.get(key) ?? "",
    getUnit: (key: string): UnitDefinition | undefined =>
      units.find((u) => u.key === key),
  };
}

/**
 * 计算单位转换
 */
export function convertUnit(
  value: number,
  fromFactor: number,
  toFactor: number,
): number {
  return (value * fromFactor) / toFactor;
}

/**
 * 生成选项列表
 */
export function generateUnitOptions(units: UnitDefinition[]) {
  return units.map((unit) => ({
    value: unit.key,
    label: `${unit.name} (${unit.symbol})`,
  }));
}
