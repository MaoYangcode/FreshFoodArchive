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
		<view class="control-row">
			<text
				v-for="opt in sortOptions"
				:key="opt.key"
				class="control-chip"
				:class="{ active: sortMode === opt.key }"
				@click="sortMode = opt.key"
			>
				<text class="chip-ico" :class="{ 'recipe-iconfont': opt.key === 'duration' || opt.key === 'difficulty' }">{{ getSortIcon(opt.key) }}</text>{{ opt.label }}
			</text>
			<text class="control-divider">|</text>
			<picker :range="cookingTimeLabels" @change="onCookingTimeChange">
				<view class="control-chip compact picker-chip">
					<text>{{ currentCookingTimeLabel }}</text>
					<text class="picker-arrow">▼</text>
				</view>
			</picker>
		</view>
		<view class="recipe-card" v-for="item in displayRecipes" :key="item.id" @click="openDetail(item)">
			<view class="recipe-avatar">
				<IngredientIcon :name="pickRecipeCoverName(item)" :size="44" />
			</view>
			<view class="recipe-main">
				<view class="title-row">
					<view class="name-score-row">
						<text class="name">{{ item.name }}</text>
						<text class="score-pill">匹配度 {{ item.score }}%</text>
					</view>
				</view>
				<view class="meta">
					<text class="meta-item"><text class="meta-icon recipe-iconfont">&#xe621;</text>{{ item.duration }}分钟</text>
					<text class="meta-dot">·</text>
					<text class="meta-item"><text class="meta-icon recipe-iconfont">&#xe6a1;</text>{{ item.difficulty }}</text>
				</view>
			</view>
			<text class="recipe-cta" :class="{ blue: idx === 0 }">查看做法</text>
		</view>
		<view v-if="!displayRecipes.length" class="empty-hint">当前筛选条件下暂无菜谱，试试取消筛选。</view>
		<BottomNav current="recipe" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'

export default {
	components: { BottomNav, IngredientIcon },
	data() {
		return {
			pantryTags: ['番茄', '鸡蛋', '牛肉', '洋葱'],
			sortMode: 'score',
			sortOptions: [
				{ key: 'score', label: '按匹配度' },
				{ key: 'duration', label: '按用时' },
				{ key: 'difficulty', label: '按难度' }
			],
			cookingTimeOptions: [0, 20, 30, 45, 60],
			selectedCookingTime: 30,
			recipes: [
				{
					id: 1,
					name: '番茄炒蛋',
					score: 96,
					duration: 10,
					difficulty: '简单',
					emoji: '🍅',
					sourceIndex: 0,
					raw: { ingredients: [{ name: '番茄' }, { name: '鸡蛋' }] }
				},
				{
					id: 2,
					name: '黑椒牛肉',
					score: 89,
					duration: 18,
					difficulty: '中等',
					emoji: '🥩',
					sourceIndex: 1,
					raw: { ingredients: [{ name: '牛肉' }, { name: '洋葱' }] }
				}
			]
		}
	},
	computed: {
		cookingTimeLabels() {
			return this.cookingTimeOptions.map((v) => (v <= 0 ? '不限时长' : `${v}分钟内`))
		},
		currentCookingTimeLabel() {
			const v = Number(this.selectedCookingTime || 0)
			return v <= 0 ? '不限时长' : `${v}分钟内`
		},
		displayRecipes() {
			const pantrySet = new Set(this.pantryTags.map((x) => this.normalizeName(x)).filter(Boolean))
			const withHint = this.recipes.map((item) => {
				const required = Array.isArray(item?.raw?.ingredients)
					? item.raw.ingredients.map((x) => this.normalizeName(x?.name)).filter(Boolean)
					: []
				const missing = required.filter((name) => !pantrySet.has(name))
				const missingCount = missing.length
				const missingText =
					required.length === 0 ? '食材信息待补充' : missingCount === 0 ? '可直接做' : `缺少 ${missingCount} 项食材`
				return { ...item, missingCount, missingText }
			})

			const filtered = withHint.filter((item) => {
				const limit = Number(this.selectedCookingTime || 0)
				if (limit > 0 && Number(item.duration || 0) > limit) return false
				return true
			})

			return filtered.sort((a, b) => this.compareRecipes(a, b))
		}
	},
	onShow() {
		this.loadGeneratedRecipes()
	},
	methods: {
		onCookingTimeChange(e) {
			const idx = Number(e?.detail?.value)
			if (!Number.isFinite(idx) || idx < 0 || idx >= this.cookingTimeOptions.length) return
			this.selectedCookingTime = this.cookingTimeOptions[idx]
		},
		getSortIcon(key) {
			if (key === 'score') return '◎'
			if (key === 'duration') return '\ue621'
			if (key === 'difficulty') return '\ue6a1'
			return ''
		},
		loadGeneratedRecipes() {
			const pantry = uni.getStorageSync('latestPantryTags')
			if (Array.isArray(pantry) && pantry.length) {
				this.pantryTags = pantry
			}

			const generated = uni.getStorageSync('latestGeneratedRecipes')
			if (!Array.isArray(generated) || !generated.length) return

			this.recipes = generated.map((item, idx) => ({
				id: item.id || idx + 1,
				name: item.name || `菜谱 ${idx + 1}`,
				score: Number(item.matchScore || item.score || 85),
				duration: Number(item.duration || 15),
				difficulty: item.difficulty || '简单',
				emoji: this.pickEmoji(item),
				sourceIndex: idx,
				raw: item
			}))
		},
		normalizeName(text) {
			return `${text || ''}`.trim().replace(/\s+/g, '').toLowerCase()
		},
		getDifficultyWeight(v) {
			if (v === '简单') return 1
			if (v === '中等') return 2
			if (v === '困难') return 3
			return 9
		},
		compareRecipes(a, b) {
			if (this.sortMode === 'duration') {
				if (a.duration !== b.duration) return a.duration - b.duration
				if (a.score !== b.score) return b.score - a.score
				return (a.sourceIndex || 0) - (b.sourceIndex || 0)
			}
			if (this.sortMode === 'difficulty') {
				const diff = this.getDifficultyWeight(a.difficulty) - this.getDifficultyWeight(b.difficulty)
				if (diff !== 0) return diff
				if (a.score !== b.score) return b.score - a.score
				return (a.sourceIndex || 0) - (b.sourceIndex || 0)
			}
			if (a.score !== b.score) return b.score - a.score
			if (a.duration !== b.duration) return a.duration - b.duration
			return (a.sourceIndex || 0) - (b.sourceIndex || 0)
		},
		pickEmoji(item) {
			const text = `${item?.name || ''} ${Array.isArray(item?.ingredients) ? item.ingredients.map((x) => x?.name || '').join(' ') : ''}`
			if (text.includes('牛') || text.includes('肉')) return '🥩'
			if (text.includes('鸡') || text.includes('蛋')) return '🍳'
			if (text.includes('鱼')) return '🐟'
			if (text.includes('虾')) return '🍤'
			return '🍽️'
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
			if (item && item.raw) {
				uni.setStorageSync('latestRecipeDetail', item.raw)
			}
			uni.navigateTo({ url: `/pages/recipe/detail?name=${encodeURIComponent(item.name)}` })
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

.control-row {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8rpx;
	margin-bottom: 8rpx;
}

.chip-ico {
	margin-right: 5rpx;
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

.control-divider {
	color: #c0c9d4;
	padding: 0 4rpx;
}

.control-chip {
	padding: 7rpx 14rpx;
	border-radius: 999rpx;
	font-size: 12px;
	background: #f4f6f9;
	color: #4e5f74;
	font-weight: 600;
}

.control-chip.compact {
	padding: 7rpx 12rpx;
}

.picker-chip {
	display: inline-flex;
	align-items: center;
	gap: 6rpx;
	border: 1rpx solid #f2d6b0;
	background: #fff8ef;
	color: #b68652;
}

.picker-arrow {
	font-size: 10px;
	color: #b68652;
	line-height: 1;
}

.control-chip.active {
	background: #e8effd;
	color: #4b74d9;
	font-weight: 600;
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
	border-radius: 14px;
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
	font-size: 15px;
	color: #1f2a22;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	line-height: 1.25;
	max-width: 320rpx;
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
	flex-shrink: 0;
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

.chip-ico.recipe-iconfont,
.meta-icon.recipe-iconfont {
	font-size: 14px;
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

.recipe-cta.blue {
	background: #edf4ff;
	color: #4a73d9;
}

.empty-hint {
	margin-top: 16rpx;
	text-align: center;
	color: #8a939e;
	font-size: 12px;
}

</style>
