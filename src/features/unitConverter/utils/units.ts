/**
 * 单位数据定义
 */
import type { UnitDefinition } from "./converter"

// 长度单位
export const LENGTH_UNITS: UnitDefinition[] = [
  {
    key: "nanometer",
    name: "纳米",
    symbol: "nm",
    factor: 1e-9,
  },
  {
    key: "micrometer",
    name: "微米",
    symbol: "μm",
    factor: 1e-6,
  },
  {
    key: "millimeter",
    name: "毫米",
    symbol: "mm",
    factor: 1e-3,
  },
  {
    key: "centimeter",
    name: "厘米",
    symbol: "cm",
    factor: 1e-2,
  },
  {
    key: "meter",
    name: "米",
    symbol: "m",
    factor: 1,
  },
  {
    key: "kilometer",
    name: "千米",
    symbol: "km",
    factor: 1e3,
  },
  {
    key: "inch",
    name: "英寸",
    symbol: "in",
    factor: 0.0254,
  },
  {
    key: "foot",
    name: "英尺",
    symbol: "ft",
    factor: 0.3048,
  },
  {
    key: "yard",
    name: "码",
    symbol: "yd",
    factor: 0.9144,
  },
  {
    key: "mile",
    name: "英里",
    symbol: "mi",
    factor: 1609.344,
  },
]

// 面积单位
export const AREA_UNITS: UnitDefinition[] = [
  {
    key: "squareMillimeter",
    name: "平方毫米",
    symbol: "mm²",
    factor: 1e-6,
  },
  {
    key: "squareCentimeter",
    name: "平方厘米",
    symbol: "cm²",
    factor: 1e-4,
  },
  {
    key: "squareMeter",
    name: "平方米",
    symbol: "m²",
    factor: 1,
  },
  {
    key: "squareKilometer",
    name: "平方千米",
    symbol: "km²",
    factor: 1e6,
  },
  {
    key: "hectare",
    name: "公顷",
    symbol: "ha",
    factor: 10000,
  },
  {
    key: "squareInch",
    name: "平方英寸",
    symbol: "in²",
    factor: 0.00064516,
  },
  {
    key: "squareFoot",
    name: "平方英尺",
    symbol: "ft²",
    factor: 0.092903,
  },
  {
    key: "squareYard",
    name: "平方码",
    symbol: "yd²",
    factor: 0.836127,
  },
  {
    key: "acre",
    name: "英亩",
    symbol: "ac",
    factor: 4046.856,
  },
  {
    key: "squareMile",
    name: "平方英里",
    symbol: "mi²",
    factor: 2589988.11,
  },
]

// 体积单位
export const VOLUME_UNITS: UnitDefinition[] = [
  {
    key: "milliliter",
    name: "毫升",
    symbol: "mL",
    factor: 1e-6,
  },
  {
    key: "centiliter",
    name: "厘升",
    symbol: "cL",
    factor: 1e-5,
  },
  {
    key: "deciliter",
    name: "分升",
    symbol: "dL",
    factor: 1e-4,
  },
  {
    key: "liter",
    name: "升",
    symbol: "L",
    factor: 0.001,
  },
  {
    key: "cubicMillimeter",
    name: "立方毫米",
    symbol: "mm³",
    factor: 1e-9,
  },
  {
    key: "cubicCentimeter",
    name: "立方厘米",
    symbol: "cm³",
    factor: 1e-6,
  },
  {
    key: "cubicMeter",
    name: "立方米",
    symbol: "m³",
    factor: 1,
  },
  {
    key: "cubicKilometer",
    name: "立方千米",
    symbol: "km³",
    factor: 1e9,
  },
  {
    key: "teaspoon",
    name: "茶匙",
    symbol: "tsp",
    factor: 4.92892e-6,
  },
  {
    key: "tablespoon",
    name: "汤匙",
    symbol: "tbsp",
    factor: 1.47868e-5,
  },
  {
    key: "fluidOunce",
    name: "液盎司",
    symbol: "fl oz",
    factor: 2.95735e-5,
  },
  {
    key: "cup",
    name: "杯",
    symbol: "cup",
    factor: 0.000236588,
  },
  {
    key: "pint",
    name: "品脱",
    symbol: "pt",
    factor: 0.000473176,
  },
  {
    key: "quart",
    name: "夸脱",
    symbol: "qt",
    factor: 0.000946353,
  },
  {
    key: "gallon",
    name: "加仑",
    symbol: "gal",
    factor: 0.00378541,
  },
  {
    key: "cubicInch",
    name: "立方英寸",
    symbol: "in³",
    factor: 1.63871e-5,
  },
  {
    key: "cubicFoot",
    name: "立方英尺",
    symbol: "ft³",
    factor: 0.0283168,
  },
  {
    key: "cubicYard",
    name: "立方码",
    symbol: "yd³",
    factor: 0.764555,
  },
]

// 质量单位
export const MASS_UNITS: UnitDefinition[] = [
  {
    key: "microgram",
    name: "微克",
    symbol: "μg",
    factor: 1e-9,
  },
  {
    key: "milligram",
    name: "毫克",
    symbol: "mg",
    factor: 1e-6,
  },
  {
    key: "gram",
    name: "克",
    symbol: "g",
    factor: 0.001,
  },
  {
    key: "kilogram",
    name: "千克",
    symbol: "kg",
    factor: 1,
  },
  {
    key: "metricTon",
    name: "公吨",
    symbol: "t",
    factor: 1000,
  },
  {
    key: "carat",
    name: "克拉",
    symbol: "ct",
    factor: 0.0002,
  },
  {
    key: "ounce",
    name: "盎司",
    symbol: "oz",
    factor: 0.0283495,
  },
  {
    key: "pound",
    name: "磅",
    symbol: "lb",
    factor: 0.453592,
  },
  {
    key: "stone",
    name: "石",
    symbol: "st",
    factor: 6.35029,
  },
  {
    key: "shortTon",
    name: "短吨",
    symbol: "US ton",
    factor: 907.185,
  },
  {
    key: "longTon",
    name: "长吨",
    symbol: "UK ton",
    factor: 1016.05,
  },
  {
    key: "grain",
    name: "格令",
    symbol: "gr",
    factor: 6.47989e-5,
  },
  {
    key: "dram",
    name: "打兰",
    symbol: "dr",
    factor: 0.00177185,
  },
  {
    key: "quarter",
    name: "四分之一英担",
    symbol: "qr",
    factor: 12.7006,
  },
  {
    key: "hundredweight",
    name: "英担",
    symbol: "cwt",
    factor: 50.8023,
  },
]

// 功率单位
export const POWER_UNITS: UnitDefinition[] = [
  {
    key: "microwatt",
    name: "微瓦",
    symbol: "μW",
    factor: 1e-6,
  },
  {
    key: "milliwatt",
    name: "毫瓦",
    symbol: "mW",
    factor: 0.001,
  },
  {
    key: "watt",
    name: "瓦",
    symbol: "W",
    factor: 1,
  },
  {
    key: "kilowatt",
    name: "千瓦",
    symbol: "kW",
    factor: 1000,
  },
  {
    key: "megawatt",
    name: "兆瓦",
    symbol: "MW",
    factor: 1000000,
  },
  {
    key: "gigawatt",
    name: "吉瓦",
    symbol: "GW",
    factor: 1000000000,
  },
  {
    key: "horsepower",
    name: "马力",
    symbol: "hp",
    factor: 745.699872,
  },
  {
    key: "horsepowerMetric",
    name: "公制马力",
    symbol: "PS",
    factor: 735.49875,
  },
  {
    key: "btuPerHour",
    name: "英热单位/小时",
    symbol: "BTU/h",
    factor: 0.293071,
  },
  {
    key: "caloriePerSecond",
    name: "卡/秒",
    symbol: "cal/s",
    factor: 4.184,
  },
  {
    key: "footPoundPerSecond",
    name: "英尺磅/秒",
    symbol: "ft·lb/s",
    factor: 1.355818,
  },
  {
    key: "ergPerSecond",
    name: "尔格/秒",
    symbol: "erg/s",
    factor: 1e-7,
  },
]

// 时间单位
export const TIME_UNITS: UnitDefinition[] = [
  {
    key: "nanosecond",
    name: "纳秒",
    symbol: "ns",
    factor: 1e-9,
  },
  {
    key: "microsecond",
    name: "微秒",
    symbol: "μs",
    factor: 1e-6,
  },
  {
    key: "millisecond",
    name: "毫秒",
    symbol: "ms",
    factor: 0.001,
  },
  {
    key: "second",
    name: "秒",
    symbol: "s",
    factor: 1,
  },
  {
    key: "minute",
    name: "分钟",
    symbol: "min",
    factor: 60,
  },
  {
    key: "hour",
    name: "小时",
    symbol: "h",
    factor: 3600,
  },
  {
    key: "day",
    name: "天",
    symbol: "d",
    factor: 86400,
  },
  {
    key: "week",
    name: "周",
    symbol: "week",
    factor: 604800,
  },
  {
    key: "fortnight",
    name: "两周",
    symbol: "2 weeks",
    factor: 1209600,
  },
  {
    key: "month",
    name: "月",
    symbol: "month",
    factor: 2628000,
  },
  {
    key: "quarter",
    name: "季度",
    symbol: "quarter",
    factor: 7884000,
  },
  {
    key: "year",
    name: "年",
    symbol: "year",
    factor: 31536000,
  },
  {
    key: "decade",
    name: "十年",
    symbol: "decade",
    factor: 315360000,
  },
  {
    key: "century",
    name: "世纪",
    symbol: "century",
    factor: 3153600000,
  },
  {
    key: "millennium",
    name: "千年",
    symbol: "millennium",
    factor: 31536000000,
  },
]

// 速度单位
export const SPEED_UNITS: UnitDefinition[] = [
  {
    key: "millimeterPerSecond",
    name: "毫米/秒",
    symbol: "mm/s",
    factor: 0.001,
  },
  {
    key: "centimeterPerSecond",
    name: "厘米/秒",
    symbol: "cm/s",
    factor: 0.01,
  },
  {
    key: "meterPerSecond",
    name: "米/秒",
    symbol: "m/s",
    factor: 1,
  },
  {
    key: "kilometerPerSecond",
    name: "千米/秒",
    symbol: "km/s",
    factor: 1000,
  },
  {
    key: "kilometerPerHour",
    name: "千米/小时",
    symbol: "km/h",
    factor: 0.2777777778,
  },
  {
    key: "meterPerHour",
    name: "米/小时",
    symbol: "m/h",
    factor: 0.0002777778,
  },
  {
    key: "milePerHour",
    name: "英里/小时",
    symbol: "mph",
    factor: 0.44704,
  },
  {
    key: "footPerSecond",
    name: "英尺/秒",
    symbol: "ft/s",
    factor: 0.3048,
  },
  {
    key: "footPerHour",
    name: "英尺/小时",
    symbol: "ft/h",
    factor: 0.0000846667,
  },
  {
    key: "yardPerSecond",
    name: "码/秒",
    symbol: "yd/s",
    factor: 0.9144,
  },
  {
    key: "yardPerHour",
    name: "码/小时",
    symbol: "yd/h",
    factor: 0.000254,
  },
  {
    key: "knot",
    name: "节",
    symbol: "kn",
    factor: 0.5144444444,
  },
  {
    key: "mach",
    name: "马赫",
    symbol: "Ma",
    factor: 343,
  },
  {
    key: "speedOfLight",
    name: "光速",
    symbol: "c",
    factor: 299792458,
  },
  {
    key: "milePerSecond",
    name: "英里/秒",
    symbol: "mi/s",
    factor: 1609.344,
  },
]

// 数据存储单位
export const DATA_UNITS: UnitDefinition[] = [
  {
    key: "bit",
    name: "位",
    symbol: "bit",
    factor: 0.125,
  },
  {
    key: "byte",
    name: "字节",
    symbol: "B",
    factor: 1,
  },
  {
    key: "kilobyte",
    name: "千字节",
    symbol: "KB",
    factor: 1024,
  },
  {
    key: "megabyte",
    name: "兆字节",
    symbol: "MB",
    factor: 1048576,
  },
  {
    key: "gigabyte",
    name: "吉字节",
    symbol: "GB",
    factor: 1073741824,
  },
  {
    key: "terabyte",
    name: "太字节",
    symbol: "TB",
    factor: 1099511627776,
  },
  {
    key: "petabyte",
    name: "拍字节",
    symbol: "PB",
    factor: 1125899906842624,
  },
  {
    key: "exabyte",
    name: "艾字节",
    symbol: "EB",
    factor: 1.152921504606847e18,
  },
  {
    key: "kilobit",
    name: "千位",
    symbol: "Kbit",
    factor: 128,
  },
  {
    key: "megabit",
    name: "兆位",
    symbol: "Mbit",
    factor: 131072,
  },
  {
    key: "gigabit",
    name: "吉位",
    symbol: "Gbit",
    factor: 134217728,
  },
  {
    key: "terabit",
    name: "太位",
    symbol: "Tbit",
    factor: 137438953472,
  },
  {
    key: "petabit",
    name: "拍位",
    symbol: "Pbit",
    factor: 140737488355328,
  },
  {
    key: "exabit",
    name: "艾位",
    symbol: "Ebit",
    factor: 1.4411518807585587e17,
  },
]
