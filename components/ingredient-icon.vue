<template>
	<view class="icon-wrap" :style="wrapStyle">
		<svg v-if="symbolId" class="icon-svg" :style="svgStyle" aria-hidden="true">
			<use :href="symbolId"></use>
		</svg>
		<image v-else-if="imagePath" class="icon-img" :src="imagePath" mode="aspectFit" :style="imgStyle" />
		<text v-else class="icon-emoji">{{ emoji }}</text>
	</view>
</template>

<script>
import { getCategoryEmoji, getIngredientImagePath, getIngredientSymbolId } from '@/utils/ingredient-image'

export default {
	name: 'IngredientIcon',
	props: {
		name: { type: String, default: '' },
		category: { type: String, default: '' },
		size: { type: Number, default: 44 },
		imageScale: { type: Number, default: 1.52 }
	},
	computed: {
		imagePath() { return getIngredientImagePath(this.name, this.category) },
		symbolId() { return getIngredientSymbolId(this.name) },
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
			return { width: '78%', height: '78%' }
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

