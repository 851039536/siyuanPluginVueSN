<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="visible" class="help-dialog-overlay" @click.self="close">
        <div class="help-dialog" @click.stop>
          <div class="help-dialog-header">
            <h3>使用说明</h3>
            <Button class="help-close-btn" icon="close" variant="ghost" size="small" @click="close" />
          </div>
          <div class="help-dialog-body">
            <div class="help-section">
              <h4>功能概述</h4>
              <p>安全的密码管理工具，使用 Web Crypto API 进行端到端加密存储。所有密码均经过 AES-GCM 加密，只有您知道主密码才能解密。</p>
            </div>
            <div class="help-section">
              <h4>首次使用</h4>
              <ul>
                <li>首次打开需要创建主密码（至少6位）</li>
                <li>建议设置密码提示，方便遗忘时找回记忆</li>
                <li>主密码无法找回，请务必牢记</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>添加密码</h4>
              <ul>
                <li>点击"添加密码"按钮创建新条目</li>
                <li>选择类别、填写名称、账号和密码</li>
                <li>描述信息可选，可用于记录备注</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>查看和管理</h4>
              <ul>
                <li>点击密码区域可显示/隐藏密码</li>
                <li>再次点击密码区域可复制到剪贴板</li>
                <li>使用分类筛选快速查找特定类型的密码</li>
                <li>使用搜索框查找名称、账号或描述</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>分类管理</h4>
              <ul>
                <li>点击分类筛选器旁的设置图标管理类别</li>
                <li>可自定义类别名称和颜色</li>
                <li>默认类别不可删除</li>
                <li>删除类别前需确保该类别下无密码条目</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>数据安全</h4>
              <ul>
                <li>所有密码使用 AES-GCM-256 加密</li>
                <li>加密密钥由主密码派生，服务器端无法解密</li>
                <li>关闭对话框后自动清除内存中的解密数据</li>
                <li>可通过"导出"功能备份所有密码（明文 JSON）</li>
              </ul>
            </div>
            <div class="help-section">
              <h4>忘记密码</h4>
              <ul>
                <li>如果忘记主密码，点击"忘记密码"查看密码提示</li>
                <li>密码提示仅用于辅助记忆，无法直接找回密码</li>
                <li>如完全遗忘，需要联系开发者或手动清除插件数据</li>
              </ul>
            </div>
          </div>
          <div class="help-dialog-footer">
            <Button variant="primary" @click="close" block>
              我知道了
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue'

interface Props {
  visible: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

const close = () => {
  emit('close')
}
</script>

<style lang="scss" scoped>
@use '../styles/help.scss';
</style>
