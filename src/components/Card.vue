<template>
  <div :class="cardClasses" :style="cardStyle" v-bind="containerAttrs" @click="handleClick">
    <div v-if="$slots.header || title" class="si-card__header">
      <div class="si-card__header-content">
        <slot name="header">
          <h3 v-if="title" class="si-card__title">{{ title }}</h3>
          <p v-if="subtitle" class="si-card__subtitle">{{ subtitle }}</p>
        </slot>
      </div>
      <div v-if="$slots['header-extra']" class="si-card__header-extra">
        <slot name="header-extra" />
      </div>
    </div>

    <div v-if="$slots.cover || cover" class="si-card__cover">
      <img
        v-if="cover"
        :src="cover"
        :alt="coverAlt"
        class="si-card__cover-image"
        :class="{ 'si-card__cover-image--cover': coverFit === 'cover' }"
      />
      <slot name="cover" />
    </div>

    <div class="si-card__body" :class="{ 'si-card__body--no-padding': bodyNoPadding }">
      <slot />
    </div>

    <div v-if="$slots.footer" class="si-card__footer">
      <slot name="footer" />
    </div>

    <div v-if="loading" class="si-card__loading-overlay">
      <div class="si-card__loading-spinner" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useAttrs, useSlots } from "vue";

type CardVariant = "bordered" | "elevated" | "flat" | "outlined";
type CardSize = "small" | "medium" | "large";

interface Props {
	/** 卡片标题 */
	title?: string;
	/** 卡片副标题 */
	subtitle?: string;
	/** 封面图片 */
	cover?: string;
	/** 封面图片 alt */
	coverAlt?: string;
	/** 封面适配方式 */
	coverFit?: "contain" | "cover" | "fill";
	/** 卡片变体 */
	variant?: CardVariant;
	/** 卡片尺寸 */
	size?: CardSize;
	/** 是否可点击 */
	clickable?: boolean;
	/** 激活状态 */
	active?: boolean;
	/** 禁用状态 */
	disabled?: boolean;
	/** 加载状态 */
	loading?: boolean;
	/** 是否圆角 */
	rounded?: boolean;
	/** 主体内容是否无内边距 */
	bodyNoPadding?: boolean;
	/** 宽度 */
	width?: string | number;
	/** 高度 */
	height?: string | number;
}

type Emits = (e: "click", event: MouseEvent) => void

const props = withDefaults(defineProps<Props>(), {
	variant: "bordered",
	size: "medium",
	coverFit: "cover",
	clickable: false,
	active: false,
	disabled: false,
	loading: false,
	rounded: true,
	bodyNoPadding: false,
});

const emit = defineEmits<Emits>();
const attrs = useAttrs();
const slots = useSlots();

const containerAttrs = computed(() => {
	const { class: className, style, ...rest } = attrs;
	return rest;
});

const cardClasses = computed(() => [
	"si-card",
	`si-card--${props.variant}`,
	`si-card--${props.size}`,
	{
		"si-card--clickable": props.clickable && !props.disabled,
		"si-card--active": props.active,
		"si-card--disabled": props.disabled,
		"si-card--loading": props.loading,
		"si-card--rounded": props.rounded,
		"si-card--has-cover": props.cover || slots.cover,
	},
]);

const cardStyle = computed(() => {
	const style: Record<string, string | number> = {};
	if (props.width) {
		style.width =
			typeof props.width === "number" ? `${props.width}px` : props.width;
	}
	if (props.height) {
		style.height =
			typeof props.height === "number" ? `${props.height}px` : props.height;
	}
	return style;
});

const handleClick = (event: MouseEvent) => {
	if (props.clickable && !props.disabled && !props.loading) {
		emit("click", event);
	}
};
</script>

<style scoped lang="scss">
@use '@/variables.scss' as *;

.si-card {
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--b3-theme-background, $brand-light);
  font-family: $font-body;
  overflow: hidden;

  // 变体样式
  &--bordered {
    border: 1px solid var(--b3-border-color, $brand-subtle-gray);
  }

  &--elevated {
    border: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

    &:hover {
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
  }

  &--flat {
    border: none;
    background: var(--b3-theme-surface-lighter, $brand-light-gray);
  }

  &--outlined {
    border: 2px solid var(--b3-border-color, $brand-subtle-gray);
    background: transparent;
  }

  // 圆角
  &--rounded {
    border-radius: 8px;
  }

  // 尺寸变体
  &--small {
    .si-card__header {
      padding: 10px 12px;
    }

    .si-card__title {
      font-size: 14px;
    }

    .si-card__subtitle {
      font-size: 12px;
    }

    .si-card__body {
      padding: 12px;
    }

    .si-card__footer {
      padding: 10px 12px;
    }

    .si-card__cover {
      height: 100px;
    }
  }

  &--medium {
    .si-card__header {
      padding: 14px 16px;
    }

    .si-card__title {
      font-size: 16px;
    }

    .si-card__subtitle {
      font-size: 13px;
    }

    .si-card__body {
      padding: 16px;
    }

    .si-card__footer {
      padding: 14px 16px;
    }

    .si-card__cover {
      height: 160px;
    }
  }

  &--large {
    .si-card__header {
      padding: 18px 20px;
    }

    .si-card__title {
      font-size: 18px;
    }

    .si-card__subtitle {
      font-size: 14px;
    }

    .si-card__body {
      padding: 20px;
    }

    .si-card__footer {
      padding: 18px 20px;
    }

    .si-card__cover {
      height: 220px;
    }
  }

  // 交互状态
  &--clickable {
    cursor: pointer;

    &:hover:not(.si-card--disabled):not(.si-card--loading) {
      border-color: var(--b3-theme-secondary, $brand-blue);
      transform: translateY(-2px);
    }

    &:active:not(.si-card--disabled):not(.si-card--loading) {
      transform: translateY(0);
    }
  }

  &--active {
    border-color: var(--b3-theme-primary, $brand-orange);

    &.si-card--bordered,
    &.si-card--outlined {
      box-shadow: 0 0 0 1px var(--b3-theme-primary, $brand-orange);
    }
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  // 头部
  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--b3-border-color, $brand-light-gray);

    &-content {
      flex: 1;
      min-width: 0;
    }

    &-extra {
      flex-shrink: 0;
      margin-left: 12px;
    }
  }

  &__title {
    margin: 0;
    font-family: $font-heading;
    font-weight: 600;
    color: var(--b3-theme-on-background, $brand-dark);
    line-height: 1.4;
  }

  &__subtitle {
    margin: 4px 0 0;
    font-family: $font-body;
    font-size: 13px;
    color: var(--b3-theme-secondary, $brand-mid-gray);
    line-height: 1.4;
  }

  // 封面
  &__cover {
    position: relative;
    overflow: hidden;
    background: var(--b3-theme-surface, $brand-light-gray);

    &-image {
      width: 100%;
      height: 100%;
      object-fit: contain;

      &--cover {
        object-fit: cover;
      }
    }

    .si-card--clickable:hover &-image {
      transform: scale(1.05);
    }
  }

  // 主体
  &__body {
    flex: 1;
    color: var(--b3-theme-on-background, $brand-dark);

    &--no-padding {
      padding: 0;
    }
  }

  // 底部
  &__footer {
    border-top: 1px solid var(--b3-border-color, $brand-light-gray);
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  // 加载状态
  &__loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(var(--b3-theme-background-rgb, $brand-light), 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  &__loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--b3-theme-surface-lighter, $brand-light-gray);
    border-top-color: var(--b3-theme-primary, $brand-orange);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
