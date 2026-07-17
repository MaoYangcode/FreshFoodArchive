<template>
	<view class="nutrition-icon-wrap" :style="wrapStyle">
		<image
			v-if="iconUrl && !loadFailed"
			class="nutrition-icon-image"
			:src="iconUrl"
			:style="wrapStyle"
			mode="aspectFit"
			@error="loadFailed = true"
		></image>
		<text v-else class="nutrition-icon-fallback" :style="fallbackStyle">{{ fallback }}</text>
	</view>
</template>

<script>
const DEFAULT_BASE_URL = 'https://nnvicode.com/nutrition-icons'

function resolveBaseUrl() {
	try {
		const runtime = `${uni.getStorageSync('ffaNutritionIconBaseUrl') || ''}`.trim()
		if (runtime) return runtime.replace(/\/+$/, '')
	} catch (_) {}
	return DEFAULT_BASE_URL
}

export default {
	name: 'NutritionIcon',
	props: {
		file: { type: String, default: '' },
		fallback: { type: String, default: '·' },
		color: { type: String, default: '#58ae67' },
		size: { type: Number, default: 14 }
	},
	data() {
		return { loadFailed: false }
	},
	watch: {
		file() {
			this.loadFailed = false
		}
	},
	computed: {
		iconUrl() {
			const name = `${this.file || ''}`.trim().replace(/[^a-zA-Z0-9_-]/g, '')
			return name ? `${resolveBaseUrl()}/${name}.svg` : ''
		},
		wrapStyle() {
			const size = Math.max(10, Number(this.size || 14))
			return { width: `${size}px`, height: `${size}px` }
		},
		fallbackStyle() {
			return { color: this.color, fontSize: `${Math.max(10, Number(this.size || 14))}px` }
		}
	}
}
</script>

<style scoped>
.nutrition-icon-wrap { display: inline-flex; align-items: center; justify-content: center; }
.nutrition-icon-image { display: block; flex-shrink: 0; }
.nutrition-icon-fallback { line-height: 1; font-weight: 800; }
</style>
