<template>
	<view class="container">
		<view class="top">
			<text class="top-title">收藏菜谱</text>
			<view class="capsule" @click="goBack"><text>←</text></view>
		</view>
		<view v-if="recipes.length === 0" class="card">
			<text class="meta">暂无收藏，去菜谱详情点击“收藏该菜谱”。</text>
		</view>
		<view class="recipe-card" v-for="item in recipes" :key="item.id" @click="openDetail(item)">
			<view class="recipe-avatar">{{ item.emoji || '🍳' }}</view>
			<view>
				<text class="name">{{ item.name }}</text>
				<text class="meta">{{ item.servings || 2 }}人份 · {{ item.duration }}分钟 · {{ item.difficulty }}</text>
				<text class="reason">已收藏菜谱</text>
			</view>
			<text class="recipe-cta">查看做法</text>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
import { getFavoriteRecipes } from '@/store/app-store'
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			recipes: []
		}
	},
	onShow() {
		this.recipes = getFavoriteRecipes()
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		openDetail(item) {
			uni.navigateTo({
				url: `/pages/recipe/detail?name=${encodeURIComponent(item.name)}&fromFavorite=1`
			})
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

.recipe-card {
	display: grid;
	grid-template-columns: 64px 1fr auto;
	gap: 12rpx;
	align-items: center;
	border: 1rpx solid #edf2ef;
	border-radius: 14px;
	padding: 9px;
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
	font-size: 30px;
	background: linear-gradient(135deg, #f1f8f2, #f8fcf8);
	border: 1rpx solid #e8f1ea;
}

.name {
	font-weight: 700;
	display: block;
	font-size: 14px;
}

.meta {
	display: block;
	color: #738177;
	font-size: 12px;
	margin-top: 4rpx;
}

.reason {
	display: inline-block;
	margin-top: 6rpx;
	font-size: 11px;
	color: #4e6f56;
	background: #edf5ef;
	border-radius: 999rpx;
	padding: 3rpx 10rpx;
}

.recipe-cta {
	padding: 8rpx 14rpx;
	border-radius: 999rpx;
	font-size: 11px;
	background: #eaf7ee;
	color: #409a4d;
	font-weight: 700;
}
</style>
