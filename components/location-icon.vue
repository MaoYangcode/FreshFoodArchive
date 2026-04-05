<template>
	<view class="loc-wrap" :style="wrapStyle">
		<text class="fallback" :style="iconStyle">{{ fallbackEmoji }}</text>
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
		wrapStyle() {
			const n = Math.max(12, Number(this.size) || 18)
			return { width: `${n}px`, height: `${n}px` }
		},
		iconStyle() {
			const n = Math.max(12, Number(this.size) || 18)
			return { fontSize: `${n}px`, color: this.color }
		},
		fallbackEmoji() {
			const kind = kindFromLocation(this.location)
			if (kind === 'frozen') return '❄'
			if (kind === 'cold') return '🧊'
			if (kind === 'room') return '🌡'
			return '•'
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

.fallback {
	font-weight: 600;
	line-height: 1;
}
</style>

