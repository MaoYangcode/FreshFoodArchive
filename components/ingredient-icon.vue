<template>
	<view class="icon-wrap" :style="wrapStyle">
		<image v-if="iconUrl" class="ingredient-weapp-icon" :src="iconUrl" :style="iconStyle" mode="aspectFit" @error="onIconLoadError"></image>
		<text v-else class="icon-fallback">{{ fallbackText }}</text>
	</view>
</template>

<script>
import { getIngredientWeappColorClass } from '@/utils/ingredient-image'

const DEFAULT_ICON_BASE_URL = 'https://nnvicode.com/ingredient-svgs'

function resolveIconBaseUrl() {
	try {
		const runtime = `${uni.getStorageSync('ffaIngredientIconBaseUrl') || ''}`.trim()
		if (runtime) return runtime.replace(/\/+$/, '')
	} catch (_) {}
	return DEFAULT_ICON_BASE_URL
}

export default {
	name: 'IngredientIcon',
	props: {
		name: { type: String, default: '' },
		category: { type: String, default: '' },
		size: { type: Number, default: 44 },
		imageScale: { type: Number, default: 1.52 }
	},
	data() {
		return {
			iconLoadFailed: false
		}
	},
	watch: {
		name() {
			this.iconLoadFailed = false
		},
		category() {
			this.iconLoadFailed = false
		}
	},
	computed: {
		weappColorClass() { return getIngredientWeappColorClass(this.name, this.category) },
		iconUrl() {
			if (this.iconLoadFailed) return ''
			const cls = `${this.weappColorClass || ''}`.trim()
			const rawText = `${this.name || this.category || ''}`.trim()
			const fallbackFile = rawText.includes('冰') ? 'icon-bingxiang' : ''
			const file = (cls ? cls.replace(/^t-icon-/, '') : fallbackFile).trim()
			if (!file) return ''
			return `${resolveIconBaseUrl()}/${encodeURIComponent(file)}.svg`
		},
		fallbackText() {
			const text = `${this.name || this.category || ''}`.trim()
			return text ? text.slice(0, 1) : '食'
		},
		wrapStyle() {
			const n = Math.max(18, Number(this.size) || 44)
			return { width: `${n}px`, height: `${n}px` }
		},
		iconStyle() {
			const n = Math.max(18, Number(this.size) || 44)
			return { width: `${n}px`, height: `${n}px` }
		}
	},
	methods: {
		onIconLoadError() {
			this.iconLoadFailed = true
		}
	}
}
</script>

<style scoped>
.icon-wrap {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
.ingredient-weapp-icon {
	flex-shrink: 0;
	display: block;
}
.icon-fallback {
	font-size: 14px;
	line-height: 1;
	color: #668070;
}
</style>

