<template>
	<view class="container">
		<view class="top">
			<text class="top-title">收藏菜谱</text>
			<view class="capsule" @click="goBack"><text>←</text></view>
		</view>
		<view v-if="recipes.length > 0" class="filter-card">
			<view class="range-inline">
				<text class="range-label">收藏时间：</text>
				<picker mode="date" :value="startDate" @change="onStartDateChange">
					<view class="range-btn">{{ startDate || '开始日期' }}</view>
				</picker>
				<text class="range-sep">~</text>
				<picker mode="date" :value="endDate" @change="onEndDateChange">
					<view class="range-btn">{{ endDate || '结束日期' }}</view>
				</picker>
			</view>
			<view class="quick-row">
				<view class="quick-chip" :class="{ active: quickRange === 'all' }" @click="applyQuickRange('all')">全部</view>
				<view class="quick-chip" :class="{ active: quickRange === '7d' }" @click="applyQuickRange('7d')">近7天</view>
				<view class="quick-chip" :class="{ active: quickRange === '30d' }" @click="applyQuickRange('30d')">近30天</view>
			</view>
		</view>
		<view v-if="recipes.length > 0" class="search-wrap">
			<text class="search-ico">🔎</text>
			<input
				class="search-input"
				type="text"
				:value="keyword"
				@input="onKeywordInput"
				placeholder="输入关键字搜索食材"
				confirm-type="search"
			/>
		</view>
		<view v-if="filteredRecipes.length === 0" class="card">
			<text class="meta">{{ recipes.length === 0 ? '暂无收藏，去菜谱详情点击“收藏该菜谱”。' : '当前筛选条件下暂无收藏菜谱。' }}</text>
		</view>
		<view class="recipe-card" v-for="item in filteredRecipes" :key="item.id" @click="openDetail(item)">
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
				<view class="status-row">
					<text class="status-pill" :class="Number(item.completedCount || 0) > 0 ? 'done' : 'todo'">
						{{ Number(item.completedCount || 0) > 0 ? `已完成 ${item.completedCount}次` : '未完成' }}
					</text>
					<text v-if="item.lastCompletedAt" class="status-time">最近：{{ formatDateTime(item.lastCompletedAt) }}</text>
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
			recipes: [],
			startDate: '',
			endDate: '',
			quickRange: 'all',
			keyword: ''
		}
	},
	computed: {
		filteredRecipes() {
			const start = this.startDate
			const end = this.endDate
			const key = `${this.keyword || ''}`.trim().toLowerCase()
			return this.recipes.filter((item) => {
				const day = this.extractDay(item.favoritedAt || item.createdAt)
				if (start && day && day < start) return false
				if (end && day && day > end) return false
				if (key) {
					const ingredientText = Array.isArray(item?.raw?.ingredients)
						? item.raw.ingredients.map((x) => `${x?.name || ''}`).join(' ')
						: `${Array.isArray(item?.available) ? item.available.join(' ') : ''} ${Array.isArray(item?.missing) ? item.missing.join(' ') : ''}`
					const haystack = `${item?.name || ''} ${ingredientText}`.toLowerCase()
					if (!haystack.includes(key)) return false
				}
				return true
			})
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
		},
		formatDateTime(time) {
			if (!time) return ''
			const date = new Date(time)
			if (Number.isFinite(date.getTime())) {
				const pad = (n) => `${n}`.padStart(2, '0')
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
			}
			const text = `${time}`
			if (text.includes('T')) return text.slice(0, 10)
			return text.slice(0, 10)
		},
		extractDay(time) {
			return this.formatDateTime(time)
		},
		onStartDateChange(e) {
			this.startDate = e.detail.value
			this.quickRange = 'custom'
			if (this.endDate && this.startDate > this.endDate) {
				this.endDate = this.startDate
			}
		},
		onEndDateChange(e) {
			this.endDate = e.detail.value
			this.quickRange = 'custom'
			if (this.startDate && this.endDate < this.startDate) {
				this.startDate = this.endDate
			}
		},
		applyQuickRange(type) {
			this.quickRange = type
			if (type === 'all') {
				this.startDate = ''
				this.endDate = ''
				return
			}
			const today = new Date()
			const pad = (n) => `${n}`.padStart(2, '0')
			const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
			const end = new Date(today)
			const start = new Date(today)
			start.setDate(today.getDate() - (type === '7d' ? 6 : 29))
			this.startDate = format(start)
			this.endDate = format(end)
		},
		onKeywordInput(e) {
			this.keyword = e && e.detail ? `${e.detail.value || ''}` : ''
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

.filter-card {
	background: #fff;
	border: 1rpx solid #e8edf0;
	border-radius: 14px;
	padding: 10px;
	margin-bottom: 10rpx;
}

.range-inline {
	display: flex;
	align-items: center;
	gap: 8rpx;
	flex-wrap: wrap;
}

.range-label {
	font-size: 13px;
	font-weight: 600;
	color: #536173;
}

.range-btn {
	min-width: 160rpx;
	text-align: center;
	background: #f3f7fb;
	border: 1rpx solid #e2e8ef;
	border-radius: 999rpx;
	padding: 8rpx 12rpx;
	font-size: 12px;
	color: #5d6775;
}

.range-sep {
	color: #9aa4b2;
	font-size: 13px;
}

.quick-row {
	display: flex;
	gap: 8rpx;
	margin-top: 8rpx;
}

.quick-chip {
	background: #f3f6f8;
	color: #6b7583;
	border: 1rpx solid #e6ebef;
	border-radius: 999rpx;
	padding: 4rpx 12rpx;
	font-size: 11px;
}

.quick-chip.active {
	background: #e8f0ff;
	color: #4a73d9;
	border-color: #d9e5ff;
}

.search-wrap {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-bottom: 10rpx;
	border: 1rpx solid #e2e8ef;
	border-radius: 999rpx;
	background: #f3f7fb;
	padding: 0 10px;
	height: 32px;
	box-sizing: border-box;
}

.search-ico {
	font-size: 12px;
	color: #7c8aa0;
}

.search-input {
	flex: 1;
	height: 32px;
	line-height: 32px;
	font-size: 12px;
	color: #5d6d82;
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

.status-row {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-top: 8rpx;
}

.status-pill {
	font-size: 10px;
	border-radius: 999rpx;
	padding: 3rpx 8rpx;
}

.status-pill.todo {
	background: #eef1f4;
	color: #7a8694;
}

.status-pill.done {
	background: #e9f8ec;
	color: #3f9f4d;
}

.status-time {
	font-size: 10px;
	color: #95a09a;
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
