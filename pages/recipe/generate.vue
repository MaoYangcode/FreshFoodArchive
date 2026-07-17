<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top" :style="{ paddingRight: `${navRightGap}px` }">
			<text class="top-title">菜谱推荐</text>
		</view>
		<view class="recipe-screen">
			<view class="recipe-inner recipe-hero">
				<text class="title">菜谱推荐</text>
				<text class="meta">基于冰箱现有食材推荐</text>
				<view class="magic">
					<text class="magic-iconfont">&#xe699;</text>
				</view>
				<text class="headline">准备做饭了吗？</text>
				<view class="desc-wrap">
					<text class="desc">分析当前库存食材，快速给出可做菜谱，</text>
					<text class="desc">减少浪费并提升搭配效率。</text>
				</view>
				<button class="btn primary" :loading="isGenerating" :disabled="isGenerating" @click="generate">{{ generateButtonText }}</button>
			</view>
		</view>
		<BottomNav current="recipe" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { getIngredientList } from '@/api/modules/ingredients'
import { createRecipeTask } from '@/api/modules/recipes'
import { getCurrentUserId } from '@/utils/current-user'

const RECIPE_PANTRY_CACHE_KEY = 'FFA_RECIPE_PANTRY_CACHE'

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
			isGenerating: false,
			pantryIngredients: []
		}
	},
	computed: {
		generateButtonText() {
			return this.isGenerating ? '生成中...' : '生成菜谱'
		}
	},
	onLoad() {
		this.ensureShareMenu()
		this.hydratePantryCache()
	},
	onShow() {
		this.ensureShareMenu()
		this.hydratePantryCache()
		this.prefetchPantryIngredients()
	},
	onShareAppMessage() {
		const names = (Array.isArray(this.pantryIngredients) ? this.pantryIngredients : [])
			.map((x) => `${x?.name || ''}`.trim())
			.filter(Boolean)
			.slice(0, 3)
			.join('、')
		return {
			title: names ? `我用 ${names} 一键生成了菜谱推荐` : '我在鲜食档案一键生成了菜谱推荐',
			path: '/pages/recipe/generate'
		}
	},
	onShareTimeline() {
		return {
			title: '鲜食档案 | 一键生成菜谱推荐'
		}
	},
	methods: {
		ensureShareMenu() {
			if (typeof uni === 'undefined' || typeof uni.showShareMenu !== 'function') return
			try {
				uni.showShareMenu({
					menus: ['shareAppMessage', 'shareTimeline']
				})
			} catch (_) {}
		},
		hydratePantryCache() {
			try {
				const cached = uni.getStorageSync(RECIPE_PANTRY_CACHE_KEY)
				this.pantryIngredients = Array.isArray(cached) ? cached : []
			} catch (_) {
				this.pantryIngredients = []
			}
		},
		persistPantryCache(list) {
			try {
				uni.setStorageSync(RECIPE_PANTRY_CACHE_KEY, Array.isArray(list) ? list : [])
			} catch (_) {}
		},
		normalizeIngredients(list) {
			return (Array.isArray(list) ? list : [])
				.filter((x) => x && x.name)
				.map((x) => ({
					name: x.name,
					quantity: Number(x.quantity || 1),
					unit: x.unit || ''
				}))
		},
		async prefetchPantryIngredients() {
			try {
				const userId = getCurrentUserId()
				const listRes = await getIngredientList({ userId })
				const ingredientsRaw = unwrapListPayload(listRes)
				const ingredients = this.normalizeIngredients(ingredientsRaw)
				this.pantryIngredients = ingredients
				this.persistPantryCache(ingredients)
			} catch (_) {}
		},
		openRecipeResultPage(taskId = '') {
			const pages = getCurrentPages()
			const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''
			const targetUrl = `/pages/recipe/result${query}`
			const openWithRedirect = () => {
				uni.redirectTo({
					url: targetUrl,
					fail: () => {
						uni.reLaunch({ url: targetUrl })
					}
				})
			}
			if (Array.isArray(pages) && pages.length >= 9) {
				openWithRedirect()
				return
			}
			uni.navigateTo({
				url: targetUrl,
				fail: (err) => {
					const msg = `${err?.errMsg || ''}`
					if (msg.includes('webview count limit exceed')) {
						openWithRedirect()
						return
					}
					uni.showToast({ title: '页面跳转失败', icon: 'none' })
				}
			})
		},
		async generate() {
			if (this.isGenerating) return
			this.isGenerating = true
			try {
				const userId = getCurrentUserId()
				let ingredients = this.normalizeIngredients(this.pantryIngredients)
				if (!ingredients.length) {
					const listRes = await getIngredientList({ userId })
					const ingredientsRaw = unwrapListPayload(listRes)
					ingredients = this.normalizeIngredients(ingredientsRaw)
					this.pantryIngredients = ingredients
					this.persistPantryCache(ingredients)
				}

				if (!ingredients.length) {
					uni.showToast({ title: '暂无可用食材', icon: 'none' })
					return
				}

				const taskRes = await createRecipeTask({
					userId,
					ingredients,
					tastePreference: '家常',
					cookingTime: 30,
					count: 6
				})
				const taskId = `${taskRes?.data?.taskId || taskRes?.taskId || ''}`.trim()
				if (!taskId) {
					uni.showToast({ title: '创建生成任务失败，请重试', icon: 'none' })
					return
				}

				const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
				uni.setStorageSync('latestGeneratedRecipes', [])
				uni.setStorageSync('latestGeneratedBatchId', batchId)
				uni.setStorageSync('latestRecipeProfileApplied', null)
				uni.setStorageSync(
					'latestPantryTags',
					ingredients.slice(0, 6).map((x) => x.name).filter(Boolean)
				)
				uni.setStorageSync('latestPantryIngredients', ingredients)
				this.openRecipeResultPage(taskId)
			} catch (e) {
				console.error('生成失败', e)
				const msg = `${e?.message || e?.msg || e?.data?.message || ''}`.trim()
				uni.showToast({ title: msg || '生成失败，请稍后重试', icon: 'none' })
			} finally {
				this.isGenerating = false
			}
		}
	}
}
</script>

<style scoped>

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
	font-family: "iconfont" !important;
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
