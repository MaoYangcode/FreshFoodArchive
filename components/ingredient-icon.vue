<template>
	<view class="icon-wrap" :style="wrapStyle">
		<svg v-if="useSymbol" class="icon-svg" :style="svgStyle" aria-hidden="true">
			<use :href="symbolId"></use>
		</svg>
		<image v-else-if="imagePath" class="icon-img" :src="imagePath" mode="aspectFit" :style="imgStyle" />
		<text v-else class="icon-emoji">{{ emoji }}</text>
	</view>
</template>

<script>
import { getCategoryEmoji, getIngredientImagePath, getIngredientSymbolId } from '@/utils/ingredient-image'

const ICONFONT_VERSION = '20260405-3'

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
			symbolReady: false
		}
	},
	mounted() {
		this.ensureSymbolSprite()
	},
	watch: {
		name() {
			this.syncSymbolReady()
		}
	},
	computed: {
		imagePath() { return getIngredientImagePath(this.name, this.category) },
		symbolId() { return getIngredientSymbolId(this.name) },
		useSymbol() { return !!this.symbolId && this.symbolReady },
		emoji() { return getCategoryEmoji(this.category) },
		wrapStyle() {
			const n = Math.max(18, Number(this.size) || 44)
			return { width: `${n}px`, height: `${n}px` }
		},
		imgStyle() {
			const scale = Math.max(0.4, Number(this.imageScale) || 1)
			return { transform: `scale(${scale})` }
		},
		svgStyle() {
			return { width: '82%', height: '82%' }
		}
	},
	methods: {
		canUseDom() {
			return typeof window !== 'undefined' && typeof document !== 'undefined'
		},
		hasSymbolNode() {
			if (!this.canUseDom() || !this.symbolId) return false
			const id = this.symbolId.slice(1)
			if (!id) return false
			return !!document.getElementById(id)
		},
		syncSymbolReady() {
			this.symbolReady = this.hasSymbolNode()
		},
		waitForSymbol(maxRetry = 12, delay = 120) {
			let times = 0
			const tick = () => {
				this.syncSymbolReady()
				if (this.symbolReady || times >= maxRetry) return
				times += 1
				setTimeout(tick, delay)
			}
			tick()
		},
		ensureSymbolSprite() {
			if (!this.canUseDom()) return
			this.syncSymbolReady()
			if (this.symbolReady) return

			if (window.__ffaIconfontLoading) {
				this.waitForSymbol()
				return
			}

			window.__ffaIconfontLoading = true
			const script = document.createElement('script')
			script.src = `/static/iconfont/iconfont.js?v=${ICONFONT_VERSION}`
			script.async = true
			script.onload = () => {
				window.__ffaIconfontLoading = false
				this.waitForSymbol()
			}
			script.onerror = () => {
				window.__ffaIconfontLoading = false
			}
			document.body.appendChild(script)
			this.waitForSymbol()
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
.icon-img { width: 100%; height: 100%; }
.icon-svg { display: block; }
.icon-emoji { font-size: 20px; line-height: 1; }
</style>

