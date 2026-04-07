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
			<view class="recipe-avatar">
				<IngredientIcon :name="pickRecipeCoverName(item)" :size="44" />
			</view>
			<view class="recipe-main">
				<view class="title-row">
					<view class="name-score-row">
						<text class="name">{{ item.name }}</text>
					</view>
				</view>
				<view class="meta-row">
					<text class="meta-item"><text class="meta-icon recipe-iconfont duration-ico">&#xe621;</text>{{ item.duration }}分钟</text>
					<text class="meta-dot">·</text>
					<text class="meta-item"><text class="meta-icon recipe-iconfont">&#xe6a1;</text>{{ item.difficulty }}</text>
				</view>
			</view>
			<text class="recipe-cta">查看做法</text>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
import { getFavoriteRecipes } from '@/store/app-store'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'

export default {
	components: { BottomNav, IngredientIcon },
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
			uni.switchTab({ url: '/pages/profile/index' })
		},
		pickRecipeCoverName(item) {
			const first = Array.isArray(item?.raw?.ingredients) ? item.raw.ingredients.find((x) => x?.name)?.name : ''
			if (first) return first
			const text = `${item?.name || ''}`
			if (text.includes('牛')) return '牛肉'
			if (text.includes('鸡蛋')) return '鸡蛋'
			if (text.includes('鸡')) return '鸡肉'
			if (text.includes('土豆')) return '土豆'
			if (text.includes('黄瓜')) return '黄瓜'
			if (text.includes('番茄') || text.includes('西红柿')) return '番茄'
			return ''
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
@font-face {
	font-family: "result-iconfont";
	src: url('/static/iconfont/iconfont.ttf') format('truetype');
}

.container {
	padding: 10px 12px 88px;
}

.top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 16rpx;
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
	grid-template-columns: 68px 1fr auto;
	column-gap: 10px;
	row-gap: 8rpx;
	align-items: center;
	border: 1rpx solid #edf2ef;
	border-radius: 14px;
	padding: 10px 12px;
	background: #fff;
	margin-bottom: 10rpx;
}

.recipe-avatar {
	width: 60px;
	height: 60px;
	border-radius: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f4f9f5;
	border: 1rpx solid #e7efea;
}

.recipe-main {
	min-width: 0;
	display: flex;
	flex-direction: column;
}

.title-row {
	display: block;
}

.name-score-row {
	display: inline-flex;
	align-items: center;
	justify-content: flex-start;
	flex-wrap: nowrap;
	gap: 4rpx;
	max-width: 100%;
}

.name {
	font-weight: 700;
	font-size: 15px;
	color: #1f2a22;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 1.25;
	max-width: 320rpx;
}

.meta-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 6rpx;
	color: #738177;
	font-size: 12px;
	margin-top: 12rpx;
}

.chip-ico.recipe-iconfont,
.recipe-iconfont {
	font-family: "result-iconfont" !important;
	font-style: normal;
	font-weight: 400;
	line-height: 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
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

.meta-icon.recipe-iconfont {
	font-size: 14px;
}

.duration-ico {
	font-size: 13px !important;
}

.meta-dot {
	color: #b3bcc8;
	padding: 0 2rpx;
}

.recipe-cta {
	padding: 8rpx 13rpx;
	border-radius: 999rpx;
	font-size: 12px;
	background: #eaf7ee;
	color: #409a4d;
	font-weight: 700;
}
</style>
