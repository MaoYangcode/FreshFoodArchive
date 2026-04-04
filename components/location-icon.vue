<template>
	<view class="loc-wrap" :style="wrapStyle">
		<text v-if="iconClass" class="iconfont loc-icon" :class="iconClass" :style="iconStyle"></text>
		<text v-else class="fallback" :style="iconStyle">{{ shortLabel }}</text>
	</view>
</template>

<script>
function kindFromLocation(loc) {
	const s = `${loc || ''}`.trim()
	if (s.includes('冷冻')) return 'frozen'
	if (s.includes('冷藏')) return 'cold'
	if (s.includes('常温')) return 'room'
	return ''
}

export default {
	name: 'LocationIcon',
	props: {
		location: { type: String, default: '' },
		size: { type: Number, default: 18 },
		color: { type: String, default: '#6f8f7e' }
	},
	computed: {
		iconClass() {
			const kind = kindFromLocation(this.location)
			if (kind === 'frozen') return 'icon-lengdong'
			if (kind === 'cold') return 'icon-cold1194982easyiconnet'
			if (kind === 'room') return 'icon-wenduji-changwen'
			return ''
		},
		wrapStyle() {
			const n = Math.max(12, Number(this.size) || 18)
			return { width: `${n}px`, height: `${n}px` }
		},
		iconStyle() {
			const n = Math.max(12, Number(this.size) || 18)
			return { fontSize: `${n}px`, color: this.color }
		},
		shortLabel() {
			return `${this.location || ''}`.trim().slice(0, 1) || '—'
		}
	}
}
</script>

<style scoped>
.loc-wrap {
	flex-shrink: 0;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}

.loc-icon {
	line-height: 1;
}

.fallback {
	font-size: 11px;
	font-weight: 700;
	line-height: 1;
}
</style>

