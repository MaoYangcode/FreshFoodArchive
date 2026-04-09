<template>
	<view class="icon-wrap" :style="wrapStyle">
		<view v-if="weappColorClass" class="t-icon ingredient-weapp-icon" :class="weappColorClass" :style="iconStyle"></view>
		<text v-else class="icon-emoji">{{ emoji }}</text>
	</view>
</template>

<script>
import { getCategoryEmoji, getIngredientWeappColorClass } from '@/utils/ingredient-image'

export default {
	name: 'IngredientIcon',
	props: {
		name: { type: String, default: '' },
		category: { type: String, default: '' },
		size: { type: Number, default: 44 },
		imageScale: { type: Number, default: 1.52 }
	},
	computed: {
		weappColorClass() { return getIngredientWeappColorClass(this.name, this.category) },
		emoji() { return getCategoryEmoji(this.category) },
		wrapStyle() {
			const n = Math.max(18, Number(this.size) || 44)
			return { width: `${n}px`, height: `${n}px` }
		},
		iconStyle() {
			const n = Math.max(18, Number(this.size) || 44)
			return { width: `${n}px`, height: `${n}px` }
		}
	}
}
</script>

<style>
@import "@/pages/assets/ingredient-icons.css";
</style>

<style scoped>
.icon-wrap {
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
.ingredient-weapp-icon {
	flex-shrink: 0;
}
.icon-emoji { font-size: 20px; line-height: 1; }
</style>

