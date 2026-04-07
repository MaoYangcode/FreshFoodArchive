<template>
	<view class="container">
		<view class="top">
			<text class="top-title">菜谱推荐</text>
			<view class="capsule"><text>🔎</text></view>
		</view>
		<view class="recipe-screen">
			<view class="recipe-inner recipe-hero">
				<text class="title">智能菜谱</text>
				<text class="meta">基于冰箱现有食材推荐</text>
				<view class="magic">
					<text class="magic-iconfont">&#xe699;</text>
				</view>
				<text class="headline">准备做饭了吗？</text>
				<view class="desc-wrap">
					<text class="desc">AI 将分析当前库存食材，快速给出可做菜谱，</text>
					<text class="desc">减少浪费并提升搭配效率。</text>
				</view>
				<button class="btn primary" :loading="isGenerating" :disabled="isGenerating" @click="generate">{{ isGenerating ? '生成中...' : '生成菜谱' }}</button>
			</view>
		</view>
		<BottomNav current="recipe" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { getIngredientList } from '@/api/modules/ingredients'
import { recommendRecipes } from '@/api/modules/recipes'

function unwrapListPayload(source) {
	if (Array.isArray(source)) return source
	if (source && Array.isArray(source.data)) return source.data
	if (source && source.data && Array.isArray(source.data.data)) return source.data.data
	return []
}

export default {
	components: { BottomNav },
	data() {
		return {
			isGenerating: false
		}
	},
	methods: {
		async generate() {
			if (this.isGenerating) return
			this.isGenerating = true
			try {
				const listRes = await getIngredientList()
				const ingredientsRaw = unwrapListPayload(listRes)
				const ingredients = ingredientsRaw
					.filter((x) => x && x.name)
					.map((x) => ({
						name: x.name,
						quantity: Number(x.quantity || 1),
						unit: x.unit || ''
					}))

				if (!ingredients.length) {
					uni.showToast({ title: '暂无可用食材', icon: 'none' })
					return
				}

				const aiRes = await recommendRecipes({
					ingredients,
					tastePreference: '家常',
					cookingTime: 30,
					count: 3
				})
				const recipes = Array.isArray(aiRes?.data?.recipes) ? aiRes.data.recipes : []
				if (!recipes.length) {
					uni.showToast({ title: '未生成菜谱，请重试', icon: 'none' })
					return
				}

				uni.setStorageSync('latestGeneratedRecipes', recipes)
				uni.setStorageSync(
					'latestPantryTags',
					ingredients.slice(0, 6).map((x) => x.name).filter(Boolean)
				)
				uni.navigateTo({ url: '/pages/recipe/result' })
			} catch (e) {
				console.error('生成失败', e)
				uni.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
			} finally {
				this.isGenerating = false
			}
		}
	}
}
</script>

<style scoped>
@font-face {
	font-family: "recipe-iconfont";
	src: url('/static/iconfont/iconfont.ttf') format('truetype');
}

.container {
	padding: 10px 12px 88px;
	background: #f6f7f8;
	min-height: 100vh;
	box-sizing: border-box;
}

.top {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12rpx;
}

.top-title {
	font-size: 20px;
	font-weight: 700;
	color: #1a1f24;
}

.capsule {
	border: 1rpx solid #e8eaed;
	border-radius: 999rpx;
	background: #fff;
	padding: 8rpx 16rpx;
	font-size: 14px;
	display: flex;
	gap: 10rpx;
	box-shadow: 0 4rpx 12rpx rgba(30, 39, 53, 0.08);
}

.recipe-screen {
	background: #fff;
	border: 1rpx solid #eef0f1;
	border-radius: 18px;
	padding: 12px;
	box-shadow: 0 8rpx 20rpx rgba(18, 37, 63, 0.05);
}

.recipe-inner {
	background: #fff;
	border: 1rpx solid #eef3f1;
	border-radius: 16px;
	box-shadow: 0 8rpx 16rpx rgba(33, 60, 38, 0.05);
}

.recipe-hero {
	min-height: 900rpx;
	display: grid;
	align-content: center;
	justify-items: center;
	padding: 18rpx 16rpx 22rpx;
	text-align: center;
}

.title {
	font-size: 20px;
	font-weight: 800;
	color: #1d252f;
	letter-spacing: 1rpx;
}

.meta {
	font-size: 13px;
	color: #6b7670;
	margin-top: 12rpx;
	letter-spacing: 0.6rpx;
	line-height: 1.7;
}

.magic {
	width: 300rpx;
	height: 300rpx;
	border-radius: 50%;
	margin: 20rpx auto 12rpx;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 110rpx;
	background: radial-gradient(circle, #ebfbe9, #f7fcf7);
	border: 1rpx solid #d8ead9;
}

.magic-iconfont {
	font-family: "recipe-iconfont" !important;
	font-size: 122rpx;
	line-height: 1;
	color: #4cae57;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.headline {
	font-size: 16px;
	font-weight: 700;
	margin: 8rpx 0 18rpx;
	color: #1d252f;
	letter-spacing: 1rpx;
}

.desc-wrap {
	margin: 0 auto 24rpx;
}

.desc {
	color: #6f7d73;
	font-size: 13px;
	line-height: 1.85;
	letter-spacing: 0.6rpx;
	max-width: 620rpx;
	display: block;
}

.btn {
	width: 100%;
	max-width: 600rpx;
	border: none;
	border-radius: 14px;
	padding: 12px 12px;
	margin-top: 16rpx;
	color: #fff;
	font-size: 14px;
	font-weight: 800;
	box-shadow: 0 8rpx 16rpx rgba(58, 116, 66, 0.18);
}

.primary {
	background: linear-gradient(135deg, #70c977, #4cae57);
}
</style>
