<template>
  <div :class="selectClasses" v-bind="containerAttrs">
    <label v-if="label" class="si-select__label">
      {{ label }}
      <span v-if="required" class="si-select__required">*</span>
    </label>
    <div class="si-select__wrapper" ref="wrapperRef">
      <div
        class="si-select__trigger"
        :class="{ 'si-select__trigger--disabled': disabled }"
        :tabindex="disabled ? -1 : 0"
        @click="toggleDropdown"
        @keydown="handleKeydown"
      >
        <span v-if="selectedLabel" class="si-select__value">{{ selectedLabel }}</span>
        <span v-else class="si-select__placeholder">{{ placeholder }}</span>
        <IconWrapper
          :name="(isOpen ? 'chevronUp' : 'chevronDown') as any"
          :size="iconSize"
          class="si-select__arrow"
        />
      </div>

      <Transition name="si-select-dropdown">
        <div
          v-if="isOpen && !disabled"
          class="si-select__dropdown"
          :class="dropdownClasses"
        >
          <div v-if="filterable && filteredOptions.length > 0" class="si-select__filter">
            <input
              ref="filterInputRef"
              v-model="filterQuery"
              type="text"
              class="si-select__filter-input"
              :placeholder="filterPlaceholder"
              @click.stop
            />
          </div>

          <div v-if="filteredOptions.length === 0" class="si-select__empty">
            {{ emptyText }}
          </div>

          <div
            v-else
            class="si-select__options"
            :class="{ 'si-select__options--grouped': hasGroups }"
          >
            <template v-for="(option, index) in filteredOptions" :key="getOptionKey(option, index)">
              <!-- 分组选项 -->
              <div
                v-if="option.isGroup"
                class="si-select__group"
              >
                <div class="si-select__group-label">{{ option.label }}</div>
                <div
                  v-for="(groupOption, groupIndex) in option.options"
                  :key="getOptionKey(groupOption, groupIndex as number)"
                  class="si-select__option"
                  :class="{
                    'si-select__option--selected': isSelected(groupOption.value),
                    'si-select__option--disabled': groupOption.disabled,
                    'si-select__option--hovered': hoveredGroupKey === `${index}-${groupIndex}`
                  }"
                  @click.stop="selectOption(groupOption)"
                  @mouseenter="setHoveredGroupOption(index, groupIndex as number)"
                >
                  <slot name="option" :option="groupOption">
                    {{ groupOption.label }}
                  </slot>
                </div>
              </div>

              <!-- 普通选项 -->
              <div
                v-else
                class="si-select__option"
                :class="{
                  'si-select__option--selected': isSelected((option as SelectOption).value),
                  'si-select__option--disabled': (option as SelectOption).disabled,
                  'si-select__option--hovered': hoveredIndex === index
                }"
                @click.stop="selectOption(option as SelectOption)"
                @mouseenter="setHoveredIndex(index)"
              >
                <slot name="option" :option="option">
                  {{ (option as SelectOption).label }}
                </slot>
              </div>
            </template>
          </div>
        </div>
      </Transition>
    </div>

    <div v-if="hint" class="si-select__hint">
      {{ hint }}
    </div>
  </div>
</template>

<script setup lang="ts">
import {
	ref,
	computed,
	watch,
	onMounted,
	onUnmounted,
	nextTick,
	useAttrs,
} from "vue";
import IconWrapper from "@/components/IconWrapper.vue";

type SelectSize = "small" | "medium" | "large";

export interface SelectOption {
	/** 选项值 */
	value: string | number | boolean;
	/** 显示标签 */
	label: string;
	/** 是否禁用 */
	disabled?: boolean;
	/** 自定义数据 */
	[key: string]: any;
}

export interface SelectGroupOption {
	/** 分组标识 */
	isGroup: true;
	/** 分组标签 */
	label: string;
	/** 分组选项 */
	options: SelectOption[];
}

type OptionType = SelectOption | SelectGroupOption;

interface Props {
	/** 选项数据 */
	options: OptionType[];
	/** 绑定值 */
	modelValue?: string | number | boolean | null;
	/** 占位文本 */
	placeholder?: string;
	/** 禁用状态 */
	disabled?: boolean;
	/** 尺寸 */
	size?: SelectSize;
	/** 标签文本 */
	label?: string;
	/** 是否必填 */
	required?: boolean;
	/** 提示文本 */
	hint?: string;
	/** 是否可筛选 */
	filterable?: boolean;
	/** 筛选占位文本 */
	filterPlaceholder?: string;
	/** 空状态文本 */
	emptyText?: string;
	/** 下拉框位置 */
	placement?: "top" | "bottom" | "auto";
	/** 下拉框最大高度 */
	maxHeight?: string | number;
	/** 图标大小 */
	iconSize?: number;
	/** 是否清除 */
	clearable?: boolean;
}

interface Emits {
	(e: "update:modelValue", value: string | number | boolean | null): void;
	(
		e: "change",
		value: string | number | boolean | null,
		option: SelectOption,
	): void;
	(e: "visible-change", visible: boolean): void;
}

const props = withDefaults(defineProps<Props>(), {
	placeholder: "请选择",
	disabled: false,
	size: "medium",
	required: false,
	filterable: false,
	filterPlaceholder: "搜索...",
	emptyText: "暂无数据",
	placement: "auto",
	maxHeight: 200,
	iconSize: 14,
	clearable: false,
});

const emit = defineEmits<Emits>();
const attrs = useAttrs();

const containerAttrs = computed(() => {
	const { class: className, style, ...rest } = attrs;
	return rest;
});

// 状态
const isOpen = ref(false);
const filterQuery = ref("");
const hoveredIndex = ref(-1);
const hoveredGroupKey = ref<string | null>(null);
const wrapperRef = ref<HTMLElement>();
const filterInputRef = ref<HTMLInputElement>();

// 计算属性
const selectClasses = computed(() => [
	"si-select",
	`si-select--${props.size}`,
	{
		"si-select--disabled": props.disabled,
		"si-select--labeled": props.label,
	},
]);

const dropdownClasses = computed(() => [
	`si-select__dropdown--${props.placement}`,
]);

const selectedOption = computed(() => {
	if (props.modelValue === null || props.modelValue === undefined) {
		return null;
	}

	const findOption = (options: OptionType[]): SelectOption | null => {
		for (const option of options) {
			if ((option as SelectGroupOption).isGroup) {
				const found = (option as SelectGroupOption).options.find(
					(opt) => opt.value === props.modelValue,
				);
				if (found) return found;
			} else if (
				!(option as SelectGroupOption).isGroup &&
				(option as SelectOption).value === props.modelValue
			) {
				return option as SelectOption;
			}
		}
		return null;
	};

	return findOption(props.options);
});

const selectedLabel = computed(() => selectedOption.value?.label || "");

const hasGroups = computed(() =>
	props.options.some((option) => (option as SelectGroupOption).isGroup),
);

const filteredOptions = computed(() => {
	if (!props.filterable || !filterQuery.value) {
		return props.options;
	}

	const query = filterQuery.value.toLowerCase();

	const filterGroup = (group: SelectGroupOption): SelectGroupOption => ({
		...group,
		options: group.options.filter((opt) =>
			opt.label.toLowerCase().includes(query),
		),
	});

	const filterOption = (option: SelectOption): boolean =>
		option.label.toLowerCase().includes(query);

	return props.options.reduce<OptionType[]>((acc, option) => {
		if ((option as SelectGroupOption).isGroup) {
			const filtered = filterGroup(option as SelectGroupOption);
			if (filtered.options.length > 0) {
				acc.push(filtered);
			}
		} else if (filterOption(option as SelectOption)) {
			acc.push(option);
		}
		return acc;
	}, []);
});

// 方法
const isGroupOption = (option: OptionType): option is SelectGroupOption => {
	return (option as SelectGroupOption).isGroup === true;
};

const getOptionKey = (
	option: SelectOption | SelectGroupOption,
	index: number,
): string => {
	if (isGroupOption(option)) {
		return `group-${option.label}-${index}`;
	}
	return `option-${option.value}-${index}`;
};

const isSelected = (value: string | number | boolean) =>
	value === props.modelValue;

const setHoveredIndex = (index: number) => {
	hoveredIndex.value = index;
	hoveredGroupKey.value = null;
};

const setHoveredGroupOption = (groupIndex: number, optionIndex: number) => {
	hoveredIndex.value = -1;
	hoveredGroupKey.value = `${groupIndex}-${optionIndex}`;
};

const selectOption = (option: SelectOption) => {
	if (option.disabled) return;

	emit("update:modelValue", option.value);
	emit("change", option.value, option);
	isOpen.value = false;
	filterQuery.value = "";
};

const toggleDropdown = () => {
	if (props.disabled) return;

	isOpen.value = !isOpen.value;
	emit("visible-change", isOpen.value);

	if (isOpen.value) {
		nextTick(() => {
			if (props.filterable) {
				filterInputRef.value?.focus();
			}
		});
	}
};

const closeDropdown = () => {
	isOpen.value = false;
	emit("visible-change", false);
	filterQuery.value = "";
	hoveredIndex.value = -1;
	hoveredGroupKey.value = null;
};

const handleKeydown = (event: KeyboardEvent) => {
	if (props.disabled) return;

	switch (event.key) {
		case "Enter":
		case " ":
			event.preventDefault();
			if (isOpen.value && hoveredIndex.value >= 0) {
				const option = filteredOptions.value[hoveredIndex.value];
				if (
					option &&
					!isGroupOption(option) &&
					!(option as SelectOption).disabled
				) {
					selectOption(option as SelectOption);
				}
			} else {
				toggleDropdown();
			}
			break;
		case "Escape":
			event.preventDefault();
			closeDropdown();
			break;
		case "ArrowDown":
			event.preventDefault();
			if (!isOpen.value) {
				toggleDropdown();
			} else {
				hoveredIndex.value = Math.min(
					hoveredIndex.value + 1,
					filteredOptions.value.length - 1,
				);
			}
			break;
		case "ArrowUp":
			event.preventDefault();
			if (isOpen.value) {
				hoveredIndex.value = Math.max(hoveredIndex.value - 1, 0);
			}
			break;
		case "Tab":
			closeDropdown();
			break;
	}
};

const handleClickOutside = (event: MouseEvent) => {
	if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
		closeDropdown();
	}
};

// 监听
watch(
	() => props.modelValue,
	() => {
		filterQuery.value = "";
	},
);

// 生命周期
onMounted(() => {
	document.addEventListener("click", handleClickOutside);
});

onUnmounted(() => {
	document.removeEventListener("click", handleClickOutside);
});
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-select {
  display: inline-flex;
  flex-direction: column;
  position: relative;
  font-family: $font-body;

  &__label {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    font-size: 13px;
    font-weight: 500;
    color: var(--b3-theme-on-background);
  }

  &__required {
    color: var(--b3-theme-primary);
    margin-left: 2px;
  }

  &__wrapper {
    position: relative;
  }

  &__trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s ease;
    outline: none;
    user-select: none;

    &:hover:not(.si-select__trigger--disabled) {
      border-color: var(--b3-theme-secondary);
    }

    &:focus-visible {
      border-color: var(--b3-theme-primary);
      box-shadow: 0 0 0 3px rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.1);
    }
  }

  &__value {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--b3-theme-on-background);
  }

  &__placeholder {
    flex: 1;
    color: var(--b3-theme-secondary);
  }

  &__arrow {
    flex-shrink: 0;
    color: var(--b3-theme-secondary);
    transition: transform 0.2s ease;
  }

  &__trigger--disabled {
    background: var(--b3-theme-surface);
    cursor: not-allowed;
    opacity: 0.6;

    .si-select__arrow {
      opacity: 0.5;
    }
  }

  &__dropdown {
    position: absolute;
    z-index: 1000;
    width: 100%;
    background: var(--b3-theme-background);
    border: 1px solid var(--b3-border-color);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    margin-top: 4px;

    &--top {
      bottom: 100%;
      margin-bottom: 4px;
      margin-top: 0;
    }
  }

  &__filter {
    padding: 8px;
    border-bottom: 1px solid var(--b3-border-color);
  }

  &__filter-input {
    width: 100%;
    padding: 6px 10px;
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    font-size: 13px;
    font-family: $font-body;
    outline: none;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);

    &:focus {
      border-color: var(--b3-theme-primary);
    }

    &::placeholder {
      color: var(--b3-theme-secondary);
    }
  }

  &__empty {
    padding: 12px;
    text-align: center;
    color: var(--b3-theme-secondary);
    font-size: 13px;
  }

  &__options {
    max-height: var(--select-max-height, 200px);
    overflow-y: auto;
    overflow-x: hidden;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--b3-theme-surface-light);
      border-radius: 3px;

      &:hover {
        background: var(--b3-theme-secondary);
      }
    }

    &--grouped {
      padding: 4px 0;
    }
  }

  &__group {
    &-label {
      padding: 8px 12px 4px;
      font-size: 12px;
      font-weight: 600;
      color: var(--b3-theme-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
  }

  &__option {
    padding: 8px 12px;
    font-size: 14px;
    color: var(--b3-theme-on-background);
    cursor: pointer;
    transition: all 0.15s ease;
    user-select: none;

    &:hover,
    &--hovered {
      background: var(--b3-theme-hover, rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.08));
    }

    &--selected {
      background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.15);
      color: var(--b3-theme-primary);
      font-weight: 500;

      &:hover,
      &.si-select__option--hovered {
        background: rgba(var(--b3-theme-primary-rgb, 66, 133, 244), 0.25);
      }
    }

    &--disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__hint {
    margin-top: 4px;
    font-size: 12px;
    color: var(--b3-theme-secondary);
  }

  // 尺寸变体
  &--small {
    .si-select__trigger {
      min-height: 28px;
      padding: 4px 8px;
      font-size: 13px;
    }
  }

  &--medium {
    .si-select__trigger {
      min-height: 36px;
      padding: 6px 12px;
      font-size: 14px;
    }
  }

  &--large {
    .si-select__trigger {
      min-height: 44px;
      padding: 8px 16px;
      font-size: 15px;
    }
  }

  // 带标签时使用块级布局
  &--labeled {
    width: 100%;
  }
}

// 下拉动画
.si-select-dropdown-enter-active,
.si-select-dropdown-leave-active {
  transition: all 0.2s ease;
  transform-origin: top;
}

.si-select-dropdown-enter-from,
.si-select-dropdown-leave-to {
  opacity: 0;
  transform: scaleY(0.9) translateY(-8px);
}

.si-select__dropdown--top.si-select-dropdown-enter-active,
.si-select__dropdown--top.si-select-dropdown-leave-active {
  transform-origin: bottom;
}

.si-select__dropdown--top.si-select-dropdown-enter-from,
.si-select__dropdown--top.si-select-dropdown-leave-to {
  transform: scaleY(0.9) translateY(8px);
}
</style>
