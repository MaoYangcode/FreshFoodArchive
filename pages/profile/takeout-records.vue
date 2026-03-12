<template>
	<view class="container">
		<view class="top">
			<text class="top-title">取出记录</text>
			<view class="capsule" @click="goBack"><text>←</text></view>
		</view>
		<view v-if="records.length === 0" class="card">
			<text class="meta">暂无记录，右滑食材并点击“已取出”后会显示在这里。</text>
		</view>
		<view class="row" v-for="record in records" :key="record.id">
			<view class="ico">🗒</view>
			<view>
				<text class="name">{{ record.name }}</text>
				<text class="meta">{{ record.quantity }}{{ record.unit }} · {{ record.location }}</text>
			</view>
			<text class="tag ok">{{ formatTime(record.time) }}</text>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
import { getTakeoutRecords } from '@/store/app-store'
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			records: []
		}
	},
	onShow() {
		this.records = getTakeoutRecords()
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		formatTime(time) {
			if (!time) return '--:--'
			return `${time}`.slice(11, 16)
		}
	}
}
</script>

<style scoped>
.container {
	padding: 10px 12px 88px;
}

.top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8rpx;
}

.top-title {
	font-size: 20px;
	font-weight: 700;
}

.capsule {
	border: 1rpx solid #e2e9e4;
	border-radius: 999rpx;
	background: #fff;
	padding: 6rpx 16rpx;
	font-size: 14px;
	display: flex;
	gap: 10rpx;
}

.card {
	background: #fff;
	border: 1rpx solid #edf2ef;
	border-radius: 14px;
	padding: 10px;
}

.row {
	display: grid;
	grid-template-columns: 40px 1fr auto;
	gap: 10rpx;
	align-items: center;
	border: 1rpx solid #eef3f0;
	border-radius: 14px;
	padding: 9px;
	background: #fbfdfb;
	margin-bottom: 10rpx;
}

.ico {
	width: 40px;
	height: 40px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f1f8f2;
	font-size: 20px;
}

.name {
	display: block;
	font-size: 14px;
	font-weight: 700;
}

.meta {
	display: block;
	font-size: 12px;
	color: #738177;
	margin-top: 4rpx;
}

.tag {
	border-radius: 999rpx;
	font-size: 11px;
	padding: 4rpx 10rpx;
}

.ok {
	background: #e9f8ec;
	color: #3f9f4d;
}
</style>
