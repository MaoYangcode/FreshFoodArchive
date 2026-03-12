<template>
	<view class="container">
		<view class="top">
			<text class="top-title">智能菜谱</text>
			<view class="capsule"><text>🔥</text></view>
		</view>
		<view class="recipe-banner">
			<text class="banner-label">可用食材</text>
			<text v-for="(x, idx) in pantryTags" :key="idx" class="pill-food">{{ x }}</text>
		</view>
		<view class="recipe-card" v-for="item in recipes" :key="item.id" @click="openDetail(item)">
			<view class="recipe-avatar">{{ item.emoji }}</view>
			<view class="recipe-main">
				<view class="title-row">
					<text class="name">{{ item.name }}</text>
					<text class="score-pill">匹配度 {{ item.score }}%</text>
				</view>
				<view class="meta">
					<text class="meta-item"><text class="meta-icon">🕒</text>{{ item.duration }}分钟</text>
					<text class="meta-dot">·</text>
					<text class="meta-item"><text class="meta-icon">👨‍🍳</text>{{ item.difficulty }}</text>
				</view>
			</view>
			<text class="recipe-cta" :class="{ blue: item.id === 2 }">查看做法</text>
		</view>
		<BottomNav current="recipe" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			pantryTags: ['番茄', '鸡蛋', '牛肉', '洋葱'],
			recipes: [
				{ id: 1, name: '番茄炒蛋', score: 96, duration: 10, difficulty: '简单', emoji: '🍅' },
				{ id: 2, name: '黑椒牛肉', score: 89, duration: 18, difficulty: '中等', emoji: '🥩' }
			]
		}
	},
	methods: {
		openDetail(item) {
			uni.navigateTo({ url: `/pages/recipe/detail?name=${encodeURIComponent(item.name)}` })
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

.recipe-banner {
	border-radius: 14px;
	padding: 12rpx 14rpx;
	background: linear-gradient(135deg, #f4f8f5, #f8fbf8);
	border: 1rpx solid #e2ebe4;
	margin-bottom: 12rpx;
}

.banner-label {
	display: block;
	font-size: 12px;
	color: #66756b;
	margin-bottom: 6rpx;
}

.pill-food {
	display: inline-block;
	margin: 4rpx 8rpx 0 0;
	padding: 4rpx 12rpx;
	border-radius: 999rpx;
	font-size: 11px;
	background: #eaf2ec;
	color: #55645a;
}

.recipe-card {
	display: grid;
	grid-template-columns: 64px 1fr auto;
	column-gap: 12px;
	row-gap: 8rpx;
	align-items: center;
	border: 1rpx solid #edf2ef;
	border-radius: 14px;
	padding: 12px;
	background: #fff;
	margin-bottom: 10rpx;
}

.recipe-avatar {
	width: 64px;
	height: 64px;
	border-radius: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 44rpx;
	background: linear-gradient(135deg, #f1f8f2, #f8fcf8);
	border: 1rpx solid #e8f1ea;
}

.recipe-main {
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.title-row {
	display: flex;
	align-items: center;
	gap: 8rpx;
}

.meta {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6rpx;
	color: #738177;
	font-size: 12px;
	margin-top: 8rpx;
}

.name {
	font-weight: 700;
	font-size: 16px;
	color: #1f2a22;
}

.score-pill {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	font-size: 10px;
	font-weight: 600;
	color: #4e6f56;
	background: #edf5ef;
	border-radius: 999rpx;
	padding: 3rpx 8rpx;
	line-height: 1.2;
	white-space: nowrap;
}

.meta-item {
	display: inline-flex;
	align-items: center;
	color: #8a939e;
}

.meta-icon {
	font-size: 12px;
	margin-right: 4rpx;
	opacity: 0.9;
}

.meta-dot {
	color: #b3bcc8;
	padding: 0 2rpx;
}

.recipe-cta {
	padding: 8rpx 14rpx;
	border-radius: 999rpx;
	font-size: 11px;
	background: #eaf7ee;
	color: #409a4d;
	font-weight: 700;
}

.recipe-cta.blue {
	background: #e8f0ff;
	color: #4a73d9;
}

</style>
