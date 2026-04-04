<template>
	<view class="view-controls">
		<view class="vm-btn" @click="$emit('toggle-view')">
			<view v-if="viewMode === 'list'" class="ico-grid">
				<text class="g-cell"></text><text class="g-cell"></text>
				<text class="g-cell"></text><text class="g-cell"></text>
			</view>
			<view v-else class="ico-list">
				<view class="lr-row"><text class="lr-dot"></text><text class="lr-bar"></text></view>
				<view class="lr-row"><text class="lr-dot"></text><text class="lr-bar"></text></view>
			</view>
		</view>
		<view class="vm-btn vm-sort" @click="$emit('toggle-sort')">
			<text class="tri up" :class="{ on: sortDirection === 'asc' }"></text>
			<text class="tri down" :class="{ on: sortDirection === 'desc' }"></text>
		</view>
	</view>
</template>

<script>
export default {
	name: 'FridgeViewControls',
	props: {
		viewMode: { type: String, default: 'list' },
		sortDirection: { type: String, default: 'asc' }
	}
}
</script>

<style scoped>
.view-controls { display: flex; gap: 8rpx; }
.vm-btn {
	width: 58rpx; height: 58rpx; border-radius: 999rpx;
	background: #f2f6fb; border: 1rpx solid #e2e8f2;
	display: flex; align-items: center; justify-content: center;
}
.ico-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4rpx; width: 22rpx; }
.g-cell { width: 8rpx; height: 8rpx; background: #6a7f99; border-radius: 2rpx; }
.ico-list { display: flex; flex-direction: column; gap: 4rpx; }
.lr-row { display: flex; align-items: center; gap: 4rpx; }
.lr-dot { width: 5rpx; height: 5rpx; border-radius: 50%; background: #6a7f99; }
.lr-bar { width: 12rpx; height: 3rpx; border-radius: 999rpx; background: #6a7f99; }
.vm-sort { flex-direction: column; gap: 3rpx; }
.tri { width: 0; height: 0; border-left: 6rpx solid transparent; border-right: 6rpx solid transparent; }
.tri.up { border-bottom: 9rpx solid #9da9ba; }
.tri.down { border-top: 9rpx solid #9da9ba; }
.tri.on.up { border-bottom-color: #4f8fe8; }
.tri.on.down { border-top-color: #4f8fe8; }
</style>

