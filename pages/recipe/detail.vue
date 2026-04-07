<template>
	<view class="container">
		<view class="top">
			<text class="top-title">菜谱详情</text>
			<view class="capsule" @click="backToResult"><text>←</text></view>
		</view>
		<view class="recipe-inner">
			<view class="head">
				<view class="recipe-avatar">
					<IngredientIcon :name="pickRecipeCoverName(recipe)" :size="46" />
				</view>
				<view class="head-main">
					<text class="title">{{ recipe.name }}</text>
					<text class="meta">{{ recipe.servings }}人份 · {{ recipe.duration }}分钟 · {{ recipe.difficulty }}</text>
				</view>
			</view>

			<view class="recipe-banner">
				<view class="banner-title-row">
					<text class="banner-title">所需食材</text>
				</view>
				<text class="banner-meta">{{ recipe.ingredientsText }}</text>
			</view>

			<view class="step-card">
				<view class="step-head">
					<text class="step-title">步骤</text>
					<text class="step-meta">共{{ recipe.steps.length }}步</text>
				</view>
				<view class="step-list">
					<view v-for="(step, idx) in recipe.steps" :key="idx" class="step-item">
						<text class="step-no">{{ idx + 1 }}</text>
						<text class="step-line">{{ step }}</text>
					</view>
				</view>
			</view>

		</view>
		<view class="favorite-wrap">
			<button class="btn" :class="favorited ? 'done' : 'primary'" @click="favorite">{{ favorited ? '已收藏' : '收藏该菜谱' }}</button>
			<button class="btn basket-btn" @click="addMissingToBasket">加入缺少食材到菜篮子</button>
		</view>
		<BottomNav current="recipe" />
	</view>
</template>

<script>
import { addFavoriteRecipe, getFavoriteRecipeByName, upsertBasketItems } from '@/store/app-store'
import { getIngredientList } from '@/api/modules/ingredients'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'

export default {
	components: { BottomNav, IngredientIcon },
	data() {
		return {
			favorited: false,
			recipe: {
				name: '番茄炒蛋',
				emoji: '🍳',
				duration: 12,
				difficulty: '简单',
				servings: 2,
				ingredients: ['番茄 x2', '鸡蛋 x3', '小葱 x1', '盐 3g'],
				ingredientsText: '番茄 x2、鸡蛋 x3、小葱 x1、盐 3g',
				steps: ['西红柿切块，鸡蛋打散。', '先炒鸡蛋盛出，再炒番茄。', '回锅翻炒，调味后出锅。']
			}
		}
	},
	onLoad(query) {
		const cached = uni.getStorageSync('latestRecipeDetail')
		if (cached && typeof cached === 'object') {
			const ingredientText = Array.isArray(cached.ingredients)
				? cached.ingredients
						.map((x) => `${x?.name || ''}${x?.quantity ?? ''}${x?.unit || ''}`.trim())
						.filter(Boolean)
						.join('、')
				: ''
			const stepList = Array.isArray(cached.steps) ? cached.steps.map((x) => `${x || ''}`.trim()).filter(Boolean) : []
			this.recipe = {
				...this.recipe,
				name: cached.name || this.recipe.name,
				duration: Number(cached.duration || this.recipe.duration),
				difficulty: cached.difficulty || this.recipe.difficulty,
				ingredientsText: ingredientText || this.recipe.ingredientsText,
				ingredients: ingredientText ? ingredientText.split('、') : this.recipe.ingredients,
				steps: stepList.length ? stepList : this.recipe.steps,
				raw: cached
			}
		}
		if (query && query.name) {
			this.recipe.name = decodeURIComponent(query.name)
		}
		if (query && query.fromFavorite === '1') {
			this.favorited = true
		}
		this.syncFavoriteState()
	},
	methods: {
		syncFavoriteState() {
			const fav = getFavoriteRecipeByName(this.recipe.name)
			if (!fav) return
			this.favorited = true
		},
		favorite() {
			if (this.favorited) {
				uni.showToast({ title: '已在收藏中', icon: 'none' })
				return
			}
			const ok = addFavoriteRecipe({
				name: this.recipe.name,
				available: this.recipe.ingredients.slice(0, 2),
				missing: [],
				duration: this.recipe.duration,
				difficulty: this.recipe.difficulty,
				raw: this.recipe.raw || null
			})
			if (!ok) {
				this.favorited = true
				uni.showToast({ title: '已在收藏中', icon: 'none' })
				return
			}
			this.favorited = true
			this.syncFavoriteState()
			uni.showToast({ title: '已加入收藏', icon: 'success' })
		},
		normalizeName(text) {
			return `${text || ''}`.trim().replace(/\s+/g, '').toLowerCase()
		},
		pickRecipeIngredientItems() {
			const fromRaw = Array.isArray(this.recipe?.raw?.ingredients)
				? this.recipe.raw.ingredients
						.map((x) => ({
							name: `${x?.name || ''}`.trim(),
							quantity: Number(x?.quantity || 1),
							unit: `${x?.unit || ''}`.trim() || '份'
						}))
						.filter((x) => !!x.name)
				: []
			if (fromRaw.length) return fromRaw
			return `${this.recipe?.ingredientsText || ''}`
				.split('、')
				.map((s) => `${s || ''}`.trim())
				.filter(Boolean)
				.map((s) => ({ name: s.replace(/\d+.*$/, '').trim(), quantity: 1, unit: '份' }))
				.filter((x) => !!x.name)
		},
		unwrapListPayload(source) {
			if (Array.isArray(source)) return source
			if (source && Array.isArray(source.data)) return source.data
			if (source && source.data && Array.isArray(source.data.data)) return source.data.data
			return []
		},
		async addMissingToBasket() {
			const recipeItems = this.pickRecipeIngredientItems()
			if (!recipeItems.length) {
				uni.showToast({ title: '暂无可加入的食材', icon: 'none' })
				return
			}
			let pantryList = []
			try {
				const res = await getIngredientList()
				pantryList = this.unwrapListPayload(res)
			} catch (e) {
				pantryList = []
			}
			if (!pantryList.length) {
				const tags = uni.getStorageSync('latestPantryTags')
				pantryList = Array.isArray(tags) ? tags.map((name) => ({ name })) : []
			}
			const pantrySet = new Set(pantryList.map((x) => this.normalizeName(x?.name)).filter(Boolean))
			const missing = recipeItems.filter((x) => !pantrySet.has(this.normalizeName(x.name)))
			if (!missing.length) {
				uni.showToast({ title: '当前食材充足，无需加入', icon: 'none' })
				return
			}
			const result = upsertBasketItems(
				missing.map((x) => ({
					name: x.name,
					quantity: Number(x.quantity || 1),
					unit: x.unit || '份',
					category: '其他'
				})),
				this.recipe.name
			)
			uni.showToast({ title: `已加入菜篮子（${result.added + result.merged}项）`, icon: 'success' })
		},
		backToResult() {
			uni.navigateTo({ url: '/pages/recipe/result' })
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

.recipe-inner {
	background: #fff;
	border: 1rpx solid #eef3f1;
	border-radius: 14px;
	box-shadow: 0 10rpx 20rpx rgba(33, 60, 38, 0.06);
	padding: 16rpx;
	margin-bottom: 12rpx;
}

.head {
	display: grid;
	grid-template-columns: 64px 1fr;
	column-gap: 12px;
	row-gap: 8rpx;
	align-items: center;
	margin-bottom: 18rpx;
}

.head-main {
	min-width: 0;
}

.recipe-avatar {
	width: 64px;
	height: 64px;
	border-radius: 16px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: linear-gradient(135deg, #f1f8f2, #f8fcf8);
	border: 1rpx solid #e8f1ea;
}

.favorite-wrap {
	margin-bottom: 8rpx;
}

.title {
	display: block;
	font-size: 18px;
	font-weight: 700;
}

.meta {
	display: block;
	margin-top: 4rpx;
	font-size: 12px;
	color: #738177;
}

.recipe-banner {
	border-radius: 14px;
	padding: 12rpx 14rpx;
	background: linear-gradient(135deg, #f4f8f5, #f8fbf8);
	border: 1rpx solid #e2ebe4;
	margin-bottom: 16rpx;
}

.banner-title-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 6rpx;
}

.banner-title {
	font-weight: 700;
	font-size: 14px;
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

.banner-meta {
	color: #6f7d73;
	line-height: 1.8;
	font-size: 12px;
}

.step-card {
	border: 1rpx solid #edf2ef;
	border-radius: 14px;
	padding: 12rpx;
	background: #fff;
	margin-bottom: 10rpx;
}

.step-head {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8rpx;
}

.step-title {
	font-weight: 700;
	font-size: 14px;
}

.step-meta {
	color: #738177;
	font-size: 12px;
}

.step-line {
	flex: 1;
	color: #6f7d73;
	line-height: 1.8;
	font-size: 12px;
}

.step-item {
	display: flex;
	align-items: flex-start;
	gap: 10rpx;
	margin-bottom: 10rpx;
}

.step-item:last-child {
	margin-bottom: 0;
}

.step-no {
	width: 36rpx;
	height: 36rpx;
	border-radius: 50%;
	background: #eaf4ed;
	color: #4f9d5c;
	font-size: 11px;
	font-weight: 700;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.btn {
	width: 100%;
	border: none;
	border-radius: 16rpx;
	padding: 14rpx 12rpx;
	color: #fff;
	font-size: 14px;
	font-weight: 700;
	box-shadow: 0 8rpx 16rpx rgba(58, 116, 66, 0.22);
}

.primary {
	background: linear-gradient(135deg, #70c977, #4cae57);
}

.done {
	background: #dfece2;
	color: #4f6b56;
	box-shadow: none;
}

.basket-btn {
	margin-top: 10rpx;
	background: #eef5ef;
	color: #4b8f56;
	box-shadow: none;
}
</style>
