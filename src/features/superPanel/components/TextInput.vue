<template>
  <input
    :type="type"
    class="setting-input"
    :value="modelValue"
    :placeholder="placeholder"
    @input="handleInput"
  />
</template>

<script setup lang="ts">
interface Props {
	modelValue: string;
	type?: "text" | "password";
	placeholder?: string;
}

interface Emits {
	(e: "update:modelValue", value: string): void;
}

withDefaults(defineProps<Props>(), {
	type: "text",
});

const emit = defineEmits<Emits>();

const handleInput = (event: Event) => {
	const target = event.target as HTMLInputElement;
	emit("update:modelValue", target.value);
};
</script>

<style scoped lang="scss">
@use '../styles/index.scss';
</style>
