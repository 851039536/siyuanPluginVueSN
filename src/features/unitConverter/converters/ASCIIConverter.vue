<template>
  <div class="ascii-converter">
    <div class="converter-section">
      <h4>文本转ASCII</h4>
      <Textarea
        v-model="textInput"
        label="输入文本"
        placeholder="请输入要转换的文本"
        :rows="3"
        @input="convertTextToAscii"
      />
      <div class="output-group" v-if="asciiResult">
        <label>ASCII结果</label>
        <div class="ascii-output">{{ asciiResult }}</div>
      </div>
    </div>

    <div class="converter-section">
      <h4>ASCII转文本</h4>
      <Textarea
        v-model="asciiInput"
        label="输入ASCII码"
        placeholder="请输入ASCII码，用空格或逗号分隔"
        :rows="3"
        @input="convertAsciiToText"
      />
      <div class="output-group" v-if="textResult">
        <label>文本结果</label>
        <div class="text-output">{{ textResult }}</div>
      </div>
    </div>

    <div class="converter-section">
      <h4>ASCII码表</h4>
      <div class="ascii-table-controls">
        <label>表格范围</label>
        <div class="range-controls">
          <Input
            v-model="tableStart"
            type="number"
            size="small"
            @input="updateAsciiTable"
          />
          <span>-</span>
          <Input
            v-model="tableEnd"
            type="number"
            size="small"
            @input="updateAsciiTable"
          />
        </div>
      </div>
      <div class="ascii-table">
        <div class="table-header">
          <span>十进制</span>
          <span>十六进制</span>
          <span>二进制</span>
          <span>字符</span>
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
      <h4>使用说明</h4>
      <ul>
        <li>文本转ASCII：输入任意文本，转换为对应的ASCII码值</li>
        <li>ASCII转文本：输入ASCII码（十进制），用空格或逗号分隔</li>
        <li>ASCII码表：显示指定范围的ASCII字符对照表</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Input from '@/components/Input.vue'
import Textarea from '@/components/Textarea.vue'

interface I18n {
  textToAscii?: string
  inputText?: string
  textPlaceholder?: string
  asciiResult?: string
  asciiToText?: string
  inputAscii?: string
  asciiPlaceholder?: string
  textResult?: string
  asciiTable?: string
  tableRange?: string
  decimal?: string
  hexadecimal?: string
  binary?: string
  character?: string
  usageInfo?: string
  infoText?: string
  infoAscii?: string
  infoTable?: string
  invalidAscii?: string
}

interface Props {
  i18n?: I18n
}

defineProps<Props>()

const textInput = ref('')
const asciiResult = ref('')
const asciiInput = ref('')
const textResult = ref('')
const tableStart = ref(32)
const tableEnd = ref(126)

const convertTextToAscii = () => {
  if (!textInput.value) {
    asciiResult.value = ''
    return
  }

  const asciiCodes = []
  for (let i = 0; i < textInput.value.length; i++) {
    const char = textInput.value[i]
    const code = char.charCodeAt(0)
    asciiCodes.push(code)
  }
  asciiResult.value = asciiCodes.join(' ')
}

const convertAsciiToText = () => {
  if (!asciiInput.value) {
    textResult.value = ''
    return
  }

  try {
    const codes = asciiInput.value.split(/[\s,]+/)
      .filter(code => code.trim())
      .map(code => parseInt(code.trim()))
      .filter(code => !isNaN(code) && code >= 0 && code <= 127)

    const text = String.fromCharCode(...codes)
    textResult.value = text
  } catch (error) {
    textResult.value = '无效的ASCII码'
  }
}

const asciiTableData = computed(() => {
  const start = Math.max(0, Math.min(127, tableStart.value))
  const end = Math.max(start, Math.min(127, tableEnd.value))
  const data = []

  for (let i = start; i <= end; i++) {
    data.push({
      dec: i,
      hex: i.toString(16).toUpperCase(),
      bin: i.toString(2).padStart(8, '0'),
      char: getCharForDisplay(i)
    })
  }

  return data
})

const getCharForDisplay = (code: number): string => {
  if (code < 32) {
    // 控制字符
    const controlChars = [
      'NUL', 'SOH', 'STX', 'ETX', 'EOT', 'ENQ', 'ACK', 'BEL',
      'BS', 'HT', 'LF', 'VT', 'FF', 'CR', 'SO', 'SI',
      'DLE', 'DC1', 'DC2', 'DC3', 'DC4', 'NAK', 'SYN', 'ETB',
      'CAN', 'EM', 'SUB', 'ESC', 'FS', 'GS', 'RS', 'US'
    ]
    return controlChars[code] || ''
  } else if (code === 127) {
    return 'DEL'
  } else {
    return String.fromCharCode(code)
  }
}

const updateAsciiTable = () => {
  // 触发计算属性更新
}
</script>

<style lang="scss" scoped>
.ascii-converter {
  display: flex;
  flex-direction: column;
  gap: 20px;

  .converter-section {
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
    padding: 16px;
    background: var(--b3-theme-surface);

    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
    }

    .output-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 12px;

      label {
        font-size: 12px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
      }

      .ascii-output,
      .text-output {
        padding: 12px;
        background: var(--b3-theme-background);
        border: 1px solid var(--b3-border-color);
        border-radius: 4px;
        font-size: 14px;
        color: var(--b3-theme-primary);
        min-height: 40px;
        word-break: break-all;
      }
    }

    .ascii-table-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;

      label {
        font-size: 12px;
        font-weight: 500;
        color: var(--b3-theme-on-surface);
      }

      .range-controls {
        display: flex;
        align-items: center;
        gap: 8px;

        span {
          color: var(--b3-theme-on-surface);
          font-weight: 500;
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
        grid-template-columns: 1fr 1fr 1fr 2fr;
        background: var(--b3-primary);
        color: var(--b3-on-primary);
        font-weight: 600;
        font-size: 12px;
        padding: 8px 12px;

        span {
          text-align: center;
        }
      }

      .table-body {
        .table-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 2fr;
          border-bottom: 1px solid var(--b3-border-color);
          font-size: 12px;

          &:hover {
            background: var(--b3-theme-surface);
          }

          span {
            padding: 6px 12px;
            text-align: center;
            color: var(--b3-theme-on-surface);

            &:first-child {
              font-weight: 600;
            }

            &:last-child {
              font-weight: 500;
              color: var(--b3-theme-secondary);
            }
          }
        }
      }
    }
  }

  .converter-info {
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
    }

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 12px;
      color: var(--b3-theme-on-surface);
      line-height: 1.6;

      li {
        margin-bottom: 4px;
      }
    }
  }
}
</style>
