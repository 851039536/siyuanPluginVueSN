<template>
  <div class="appearance-settings">
    <h4>{{ i18n.appearanceSettings || '外观设置' }}</h4>

    <div class="setting-list">
      <div class="setting-item">
        <label>{{ i18n.themeMode || '主题模式' }}</label>
        <SiSelect
          v-model="themeMode"
          :options="themeOptions"
          class="compact-select"
        />
      </div>

      <div class="setting-item">
        <label>{{ i18n.interfaceScale || '界面缩放' }}</label>
        <div class="input-group">
          <SiInput
            v-model.number="interfaceScale"
            type="number"
            :min="80"
            :max="150"
            :step="10"
            class="compact-number"
          />
          <span>%</span>
        </div>
      </div>

      <div class="setting-item">
        <label>{{ i18n.showSidebar || '显示侧边栏' }}</label>
        <SiSwitch v-model="showSidebar" />
      </div>
    </div>

    <div class="action-buttons">
      <SiButton @click="save" variant="primary">{{ i18n.save || '保存' }}</SiButton>
      <SiButton @click="reset" variant="ghost">{{ i18n.reset || '重置' }}</SiButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { showMessage } from "siyuan";
import SiButton from "@/components/Button.vue";
import SiSwitch from "@/components/Switch.vue";
import SiInput from "@/components/Input.vue";
import SiSelect from "@/components/Select.vue";

interface Props {
	i18n?: any;
	plugin?: any;
}

interface Emits {
	(e: "change", settings: any): void;
}

const props = withDefaults(defineProps<Props>(), {
	i18n: () => ({}),
	plugin: null,
});

const emit = defineEmits<Emits>();

const themeMode = ref("auto");
const interfaceScale = ref(100);
const showSidebar = ref(true);

const themeOptions = [
	{ value: "auto", label: "自动" },
	{ value: "light", label: "浅色" },
	{ value: "dark", label: "深色" },
];

const DEFAULT_SETTINGS = {
	themeMode: "auto",
	interfaceScale: 100,
	showSidebar: true,
};

watch([themeMode, interfaceScale, showSidebar], () => {
	emit("change", {
		themeMode: themeMode.value,
		interfaceScale: interfaceScale.value,
		showSidebar: showSidebar.value,
	});
});

function save() {
	const settings = {
		themeMode: themeMode.value,
		interfaceScale: interfaceScale.value,
		showSidebar: showSidebar.value,
	};
	if (props.plugin) {
		try {
			props.plugin.saveData("appearance-settings", settings);
			showMessage(props.i18n.settingsSaved || "已保存", 3000, "info");
		} catch (error) {
			showMessage(props.i18n.saveFailed || "保存失败", 3000, "error");
		}
	} else {
		showMessage("插件实例不可用", 3000, "error");
	}
}

function reset() {
	themeMode.value = DEFAULT_SETTINGS.themeMode;
	interfaceScale.value = DEFAULT_SETTINGS.interfaceScale;
	showSidebar.value = DEFAULT_SETTINGS.showSidebar;

	if (props.plugin) {
		try {
			props.plugin.saveData("appearance-settings", DEFAULT_SETTINGS);
			showMessage(props.i18n.settingsReset || "已重置", 3000, "info");
		} catch (error) {
			console.error("重置失败:", error);
		}
	} else {
		showMessage("插件实例不可用", 3000, "error");
	}
}

async function loadSettings() {
	if (props.plugin) {
		try {
			const saved = await props.plugin.loadData("appearance-settings");
			if (saved) {
				themeMode.value = saved.themeMode || DEFAULT_SETTINGS.themeMode;
				interfaceScale.value =
					saved.interfaceScale || DEFAULT_SETTINGS.interfaceScale;
				showSidebar.value =
					saved.showSidebar !== undefined
						? saved.showSidebar
						: DEFAULT_SETTINGS.showSidebar;
			}
		} catch (error) {
			console.error("加载设置失败:", error);
		}
	}
}

onMounted(() => {
	loadSettings();
});
</script>

<style scoped>
.appearance-settings {
  padding: 12px;
}

.appearance-settings h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
}

.setting-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.setting-item label {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface-variant);
  min-width: 80px;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.compact-select {
  min-width: 120px;
}

.compact-number {
  width: 80px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}
</style>
