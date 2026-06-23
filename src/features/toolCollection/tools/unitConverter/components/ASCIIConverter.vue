<template>
  <div class="ascii-converter">
    <div class="converter-section">
      <h4>TEXT → ASCII</h4>
      <Input
        v-model="textInput"
        type="textarea"
        label="INPUT"
        placeholder="请输入要转换的文本"
        :rows="3"
      />
      <div
        v-if="asciiResult"
        class="output-group"
      >
        <label>OUTPUT</label>
        <div class="ascii-output">
          {{ asciiResult }}
        </div>
      </div>
    </div>

    <div class="converter-section">
      <h4>ASCII → TEXT</h4>
      <Input
        v-model="asciiInput"
        type="textarea"
        label="INPUT"
        placeholder="请输入ASCII码，用空格或逗号分隔"
        :rows="3"
      />
      <div
        v-if="textResult"
        class="output-group"
      >
        <label>OUTPUT</label>
        <div class="text-output">
          {{ textResult }}
        </div>
      </div>
    </div>

    <div class="converter-section">
      <h4>CHAR TABLE</h4>
      <div class="ascii-table-controls">
        <label>RANGE</label>
        <div class="range-controls">
          <Input
            v-model.number="tableStart"
            type="number"
            size="small"
          />
          <span>—</span>
          <Input
            v-model.number="tableEnd"
            type="number"
            size="small"
          />
        </div>
      </div>
      <div class="ascii-table">
        <div class="table-header">
          <span>DEC</span>
          <span>HEX</span>
          <span>BIN</span>
          <span>CHAR</span>
        </div>
        <div class="table-body">
          <div
            v-for="row in asciiTableData"
            :key="row.dec"
            class="table-row"
          >
            <span>{{ row.dec }}</span>
            <span>{{ row.hex }}</span>
            <span>{{ row.bin }}</span>
            <span>{{ row.char }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="converter-info">
      <h4>NOTES</h4>
      <ul>
        <li>文本转ASCII：输入任意文本，转换为对应的ASCII码值</li>
        <li>ASCII转文本：输入ASCII码（十进制），用空格或逗号分隔</li>
        <li>ASCII码表：显示指定范围的ASCII字符对照表</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  ref,
} from "vue"
import Input from "@/components/Input.vue"

const textInput = ref("")
const asciiInput = ref("")
const tableStart = ref(32)
const tableEnd = ref(126)

// 控制字符名称映射（常量）
const CONTROL_CHARS = [
  "NUL",
  "SOH",
  "STX",
  "ETX",
  "EOT",
  "ENQ",
  "ACK",
  "BEL",
  "BS",
  "HT",
  "LF",
  "VT",
  "FF",
  "CR",
  "SO",
  "SI",
  "DLE",
  "DC1",
  "DC2",
  "DC3",
  "DC4",
  "NAK",
  "SYN",
  "ETB",
  "CAN",
  "EM",
  "SUB",
  "ESC",
  "FS",
  "GS",
  "RS",
  "US",
]

// 文本转ASCII
const asciiResult = computed(() => {
  if (!textInput.value) return ""
  return Array.from(textInput.value)
    .map((char) => char.charCodeAt(0))
    .join(" ")
})

// ASCII转文本
const textResult = computed(() => {
  if (!asciiInput.value) return ""

  try {
    const codes = asciiInput.value
      .split(/[\s,]+/)
      .filter((code) => code.trim())
      .map((code) => Number.parseInt(code.trim()))
      .filter((code) => !isNaN(code) && code >= 0 && code <= 127)

    return String.fromCharCode(...codes)
  } catch {
    return "无效的ASCII码"
  }
})

// ASCII码表数据
const asciiTableData = computed(() => {
  const start = Math.max(0, Math.min(127, tableStart.value))
  const end = Math.max(start, Math.min(127, tableEnd.value))

  return Array.from({ length: end - start + 1 }, (_, i) => {
    const code = start + i
    return {
      dec: code,
      hex: code.toString(16).toUpperCase(),
      bin: code.toString(2).padStart(8, "0"),
      char: getCharForDisplay(code),
    }
  })
})

function getCharForDisplay(code: number): string {
  if (code < 32) return CONTROL_CHARS[code] || ""
  if (code === 127) return "DEL"
  return String.fromCharCode(code)
}
</script>

<style lang="scss" scoped>
@use "../styles/index.scss";

.ascii-converter {
  display: flex;
  flex-direction: column;
  gap: 14px;

  .ascii-table-controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;

    label {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.45;
      color: var(--b3-theme-on-surface);
    }

    .range-controls {
      display: flex;
      align-items: center;
      gap: 8px;

      span {
        color: var(--b3-theme-on-surface);
        opacity: 0.3;
      }
    }
  }

  .ascii-table {
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    overflow: hidden;
    max-height: 300px;
    overflow-y: auto;

    .table-header {
      display: grid;
      grid-template-columns: 1fr 1fr 1.5fr 1.5fr;
      background: var(--b3-theme-surface);
      border-bottom: 1px solid var(--b3-border-color);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--b3-theme-on-surface);
      opacity: 0.45;
      padding: 6px 10px;

      span {
        text-align: center;
      }
    }

    .table-body {
      .table-row {
        display: grid;
        grid-template-columns: 1fr 1fr 1.5fr 1.5fr;
        border-bottom: 1px solid var(--b3-border-color);
        font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
        font-size: 11px;

        &:last-child {
          border-bottom: none;
        }

        &:hover {
          background: var(--b3-theme-surface);
        }

        span {
          padding: 4px 10px;
          text-align: center;
          color: var(--b3-theme-on-surface);

          &:first-child {
            font-weight: 600;
            opacity: 0.7;
          }

          &:last-child {
            font-weight: 500;
            color: var(--b3-theme-primary);
          }
        }
      }
    }
  }
}
</style>
