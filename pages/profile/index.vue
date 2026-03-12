<template>
	<view class="container">
		<view class="top">
			<text class="top-title">我的</text>
			<view class="capsule"><text>•••</text><text>◉</text></view>
		</view>
		<view class="card head-card">
			<view class="avatar">🧊</view>
			<view>
				<text class="name">微信用户</text>
				<text class="meta">普通会员</text>
			</view>
		</view>

		<view class="menu">
			<view class="menu-item">
				<text class="micon">▦</text>
				<text>冰箱管理</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item" @click="goTakeout">
				<text class="micon">🗒</text>
				<text>取出记录</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item">
				<text class="micon">⏰</text>
				<text>临期提醒</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item" @click="goFavorites">
				<text class="micon">🧺</text>
				<text>收藏菜谱</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item">
				<text class="micon">👤</text>
				<text>我的资料</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item">
				<text class="micon">💬</text>
				<text>问题反馈</text>
				<text class="arrow">›</text>
			</view>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	methods: {
		goFavorites() {
			uni.navigateTo({ url: '/pages/profile/favorites' })
		},
		goTakeout() {
			uni.navigateTo({ url: '/pages/profile/takeout-records' })
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
	border-radius: 16px;
	padding: 12px;
	margin-bottom: 14rpx;
}

.head-card {
	display: grid;
	grid-template-columns: 72px 1fr;
	gap: 12rpx;
	align-items: center;
}

.avatar {
	width: 72px;
	height: 72px;
	border-radius: 50%;
	background: #e7f0ff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 56rpx;
}

.name {
	font-weight: 700;
	font-size: 18px;
}

.meta {
	display: block;
	margin-top: 6rpx;
	font-size: 12px;
	color: #738177;
}

.menu {
	border: 1rpx solid #edf1ef;
	border-radius: 16px;
	background: #fff;
}

.menu-item {
	display: grid;
	grid-template-columns: 42rpx 1fr auto;
	gap: 10rpx;
	align-items: center;
	padding: 16rpx 12rpx;
	border-bottom: 1rpx solid #eff3f1;
	font-size: 14px;
}

.menu-item:last-child {
	border-bottom: none;
}

.micon {
	color: #5a8ee9;
	font-size: 20px;
	text-align: center;
}

.arrow {
	font-size: 28px;
	color: #8f9792;
	line-height: 1;
}
</style>
