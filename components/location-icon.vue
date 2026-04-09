<template>
	<view class="loc-wrap" :style="wrapStyle">
		<text class="loc-font" :style="iconStyle">{{ iconChar }}</text>
	</view>
</template>

<script>
function kindFromLocation(loc) {
	const s = `${loc || ''}`.trim()
	if (s.includes('冷冻')) return 'frozen'
	if (s.includes('冷藏')) return 'cold'
	return ''
}

export default {
	name: 'LocationIcon',
	props: {
		location: { type: String, default: '' },
		size: { type: Number, default: 18 },
		color: { type: String, default: '#8fb7e8' }
	},
	computed: {
		iconChar() {
			const kind = kindFromLocation(this.location)
			if (kind === 'frozen') return '\ue636'
			if (kind === 'cold') return '\ue64d'
			return '•'
		},
		wrapStyle() {
			const n = Math.max(12, Number(this.size) || 18)
			return { width: `${n}px`, height: `${n}px` }
		},
		iconStyle() {
			const n = Math.max(12, Number(this.size) || 18)
			return { fontSize: `${n}px`, lineHeight: '1', color: this.color }
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

.loc-font {
	font-family: "iconfont" !important;
	font-weight: 400;
	line-height: 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}
</style>

