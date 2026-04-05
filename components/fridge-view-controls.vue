<template>
	<view class="view-controls">
		<view class="vm-btn active" @click="$emit('toggle-view')">
			<view v-if="viewMode === 'list'" class="ico-grid">
				<text class="g-cell"></text><text class="g-cell"></text>
				<text class="g-cell"></text><text class="g-cell"></text>
			</view>
			<view v-else class="ico-list">
				<view class="lr-row"><text class="lr-dot"></text><text class="lr-bar"></text></view>
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
.view-controls {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.vm-btn {
	width: 58rpx;
	height: 58rpx;
	border-radius: 14rpx;
	background: #f6f9ff;
	border: 1rpx solid #dbe6f7;
	display: flex;
	align-items: center;
	justify-content: center;
	box-shadow: inset 0 1rpx 0 rgba(255, 255, 255, 0.9);
}

.vm-btn.active {
	background: linear-gradient(180deg, #fafdff, #eef5ff);
	border-color: #a7c6f4;
	box-shadow: 0 4rpx 10rpx rgba(93, 143, 224, 0.16);
}

.ico-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 4rpx;
	width: 22rpx;
}

.g-cell {
	width: 9rpx;
	height: 9rpx;
	background: linear-gradient(135deg, #9bc4ff 0%, #6b9ef0 55%, #4f86e8 100%);
	border-radius: 3rpx;
}

.ico-list {
	display: flex;
	flex-direction: column;
	gap: 4rpx;
}

.lr-row {
	display: flex;
	align-items: center;
	gap: 4rpx;
}

.lr-dot {
	width: 5rpx;
	height: 5rpx;
	border-radius: 2rpx;
	background: linear-gradient(135deg, #9bc4ff 0%, #6b9ef0 55%, #4f86e8 100%);
}

.lr-bar {
	width: 14rpx;
	height: 4rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, #9bc4ff 0%, #6b9ef0 55%, #4f86e8 100%);
}

.vm-sort {
	flex-direction: column;
	gap: 3rpx;
}

.tri {
	width: 0;
	height: 0;
	border-left: 6rpx solid transparent;
	border-right: 6rpx solid transparent;
}

.tri.up { border-bottom: 9rpx solid #9da9ba; }
.tri.down { border-top: 9rpx solid #9da9ba; }
.tri.on.up { border-bottom-color: #4f8fe8; }
.tri.on.down { border-top-color: #4f8fe8; }
</style>

