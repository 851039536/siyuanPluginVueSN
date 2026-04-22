import { Plugin } from "siyuan";
import { createApp } from "vue";
import App from "./App.vue";
import type PluginSample from "@/index";
import "highlight.js/styles/github-dark.css";

let plugin: Plugin | null = null;
export function usePlugin(pluginProps?: Plugin): Plugin {
	if (pluginProps) {
		plugin = pluginProps;
	}
	if (!plugin && !pluginProps) {
		console.error("need bind plugin");
	}
	return plugin as Plugin;
}

let app: ReturnType<typeof createApp> | null = null;
export function init(pluginInstance: Plugin) {
	// bind plugin hook
	usePlugin(pluginInstance);

	// 初始化时应用紧凑模式
	const pluginSample = pluginInstance as PluginSample;
	if (pluginSample.settings?.compactMode) {
		document.documentElement.classList.add("siyuan-compact-mode");
	}

	const div = document.createElement("div");
	div.classList.toggle("siyuan-plugin-vite-vue-sn-app");
	div.id = pluginInstance.name;
	app = createApp(App);
	app.mount(div);

	document.body.appendChild(div);
}

export function destroy() {
	app?.unmount();
	app = null;
	const div = document.getElementById(plugin?.name ?? "");
	div?.remove();
}
