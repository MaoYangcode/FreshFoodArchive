<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top" :style="{ paddingRight: `${navRightGap}px` }">
			<text class="top-title">我的</text>
		</view>
		<view class="card head-card">
			<view class="avatar">
				<image v-if="profileAvatar" class="avatar-img" :src="profileAvatar" mode="aspectFill" />
				<text v-else class="avatar-fallback">&#xe615;</text>
			</view>
			<view>
				<text class="name">{{ profileName }}</text>
				<text class="meta">普通会员</text>
			</view>
		</view>
		<view class="today-plan-card" @click="goMealPlan">
			<view class="today-plan-top">
				<view><text class="today-plan-kicker">TODAY</text><text class="today-plan-title">今日饮食计划</text></view>
				<text class="today-plan-arrow">›</text>
			</view>
			<view v-if="todayPlans.length" class="today-plan-content">
				<view v-for="meal in todayMealSummary" :key="meal.key" class="today-meal" :class="{ arranged: meal.recipes.length }">
					<text class="today-meal-label">{{ meal.label }}</text>
					<text class="today-meal-name">{{ meal.recipes.length ? meal.recipes.join('、') : '未安排' }}</text>
				</view>
			</view>
			<view v-else class="today-plan-empty"><text>今天还没有安排</text><text class="today-plan-add">去添加计划</text></view>
		</view>

		<view class="menu">
			<view class="menu-item group-end" @click="goFridge">
				<text class="micon">&#xe90b;</text>
				<text>冰箱管理</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item group-end" @click="goTakeout">
				<text class="micon">&#xe614;</text>
				<text>取出记录</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item group-end" @click="goExpiryReminder">
				<text class="micon">&#xe629;</text>
				<text>临期提醒</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-sep"></view>
			<view class="menu-item group-end" @click="goFavorites">
				<text class="micon">&#xe62e;</text>
				<text>收藏菜谱</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-item group-end" @click="goBasket">
				<text class="micon">&#xe61b;</text>
				<text>菜篮子</text>
				<text class="arrow">›</text>
			</view>
			<view class="menu-sep"></view>
			<view class="menu-item group-end" @click="goProfile">
				<text class="micon">&#xe632;</text>
				<text>我的资料</text>
				<text class="arrow">›</text>
			</view>
			<button class="menu-item contact-item" open-type="contact">
				<text class="micon">&#xe631;</text>
				<text>问题反馈</text>
				<text class="arrow">›</text>
			</button>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { getProfile } from '@/api/modules/profile'
import { getCurrentUserId } from '@/utils/current-user'
import { getMealPlans } from '@/store/app-store'
import { syncMealPlans } from '@/utils/user-data-sync'

const PROFILE_HEADER_CACHE_KEY = 'FFA_PROFILE_HEADER_CACHE'

export default {
	components: { BottomNav },
	data() {
		return {
			userId: getCurrentUserId(),
			profileName: '微信用户',
			profileAvatar: '',
			todayPlans: []
		}
	},
	computed: {
		todayMealSummary() {
			return [
				{ key: 'breakfast', label: '早餐' },
				{ key: 'lunch', label: '午餐' },
				{ key: 'dinner', label: '晚餐' }
			].map((meal) => ({ ...meal, recipes: this.todayPlans.filter((item) => item.meal === meal.key).map((item) => item.recipeName) }))
		}
	},
	onLoad() {
		this.ensureShareMenu()
		this.hydrateProfileHeader()
	},
	onShow() {
		this.ensureShareMenu()
		this.userId = getCurrentUserId()
		this.hydrateProfileHeader()
		this.loadProfileHeader()
		this.loadTodayPlans()
	},
	onShareAppMessage() {
		const nickname = `${this.profileName || ''}`.trim() || '微信用户'
		return {
			title: `${nickname} 正在使用鲜食档案管理厨房库存`,
			path: '/pages/profile/index'
		}
	},
	onShareTimeline() {
		return {
			title: '鲜食档案 | 我的厨房食材管理助手'
		}
	},
	methods: {
		formatToday() {
			const date = new Date()
			const pad = (n) => `${n}`.padStart(2, '0')
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
		},
		async loadTodayPlans() {
			this.todayPlans = getMealPlans(this.formatToday())
			try {
				await syncMealPlans()
				this.todayPlans = getMealPlans(this.formatToday())
			} catch (_) {}
		},
		ensureShareMenu() {
			if (typeof uni === 'undefined' || typeof uni.showShareMenu !== 'function') return
			try {
				uni.showShareMenu({
					menus: ['shareAppMessage', 'shareTimeline']
				})
			} catch (_) {}
		},
		safeNavigate(url) {
			const target = `${url || ''}`.trim()
			if (!target) return
			const openWithRedirect = () => {
				uni.redirectTo({
					url: target,
					fail: () => {
						uni.reLaunch({ url: target })
					}
				})
			}
			const pages = getCurrentPages()
			if (Array.isArray(pages) && pages.length >= 9) {
				openWithRedirect()
				return
			}
			uni.navigateTo({
				url: target,
				fail: (err) => {
					const msg = `${err?.errMsg || ''}`
					if (msg.includes('webview count limit exceed')) {
						openWithRedirect()
						return
					}
					uni.showToast({ title: '页面打开失败', icon: 'none' })
				}
			})
		},
		hydrateProfileHeader() {
			try {
				const cached = uni.getStorageSync(PROFILE_HEADER_CACHE_KEY)
				const cacheUserId = Number(cached?.userId || 0)
				if (!cacheUserId || cacheUserId !== Number(this.userId || 0)) return
				this.profileName = `${cached?.name || '微信用户'}`.trim() || '微信用户'
				this.profileAvatar = `${cached?.avatar || ''}`.trim()
			} catch (_) {}
		},
		persistProfileHeaderCache(payload) {
			try {
				uni.setStorageSync(PROFILE_HEADER_CACHE_KEY, {
					userId: Number(this.userId || 0),
					name: `${payload?.name || '微信用户'}`.trim() || '微信用户',
					avatar: `${payload?.avatar || ''}`.trim()
				})
			} catch (_) {}
		},
		async loadProfileHeader() {
			try {
				const res = await getProfile(this.userId)
				this.profileName = `${res?.name || '微信用户'}`.trim() || '微信用户'
				this.profileAvatar = `${res?.avatar || ''}`.trim()
				this.persistProfileHeaderCache({ name: this.profileName, avatar: this.profileAvatar })
			} catch (e) {
				if (!`${this.profileName || ''}`.trim()) this.profileName = '微信用户'
			}
		},
		goFridge() {
			this.safeNavigate('/pages/fridge/shelf-life')
		},
		goFavorites() {
			this.safeNavigate('/pages/profile/favorites')
		},
		goTakeout() {
			this.safeNavigate('/pages/profile/takeout-records')
		},
		goBasket() {
			this.safeNavigate('/pages/profile/basket')
		},
		goExpiryReminder() {
			this.safeNavigate('/pages/profile/expiry-reminder')
		},
		goProfile() {
			this.safeNavigate('/pages/profile/profile')
		},
		goMealPlan() {
			this.safeNavigate(`/pages/recipe/generate?tab=plan&date=${this.formatToday()}`)
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
	margin-top: 10rpx;
}

.avatar {
	width: 72px;
	height: 72px;
	border-radius: 50%;
	background: #eaf7ee;
	display: flex;
	align-items: center;
	justify-content: center;
	overflow: hidden;
}

.avatar-img {
	width: 100%;
	height: 100%;
	display: block;
}

.avatar-fallback {
	font-family: "iconfont" !important;
	font-size: 64rpx;
	color: #34a853;
	line-height: 1;
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

.today-plan-card {
	margin-bottom: 14rpx;
	padding: 22rpx;
	border: 1rpx solid #e4eee6;
	border-radius: 16px;
	background: linear-gradient(145deg, #f2faf3, #fff);
	box-shadow: 0 7rpx 20rpx rgba(42, 86, 49, .05);
}

.today-plan-top {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.today-plan-kicker {
	display: block;
	color: #79a980;
	font-size: 8px;
	font-weight: 800;
	letter-spacing: 3rpx;
}

.today-plan-title {
	display: block;
	margin-top: 5rpx;
	color: #29342c;
	font-size: 15px;
	font-weight: 800;
}

.today-plan-arrow {
	color: #a7b4aa;
	font-size: 28px;
	line-height: 1;
}

.today-plan-content {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 10rpx;
	margin-top: 18rpx;
}

.today-meal {
	min-width: 0;
	padding: 14rpx 12rpx;
	border-radius: 10px;
	background: rgba(255,255,255,.72);
}

.today-meal.arranged {
	background: #e8f6eb;
}

.today-meal-label,
.today-meal-name {
	display: block;
}

.today-meal-label {
	color: #64a16d;
	font-size: 9px;
	font-weight: 700;
}

.today-meal-name {
	margin-top: 7rpx;
	overflow: hidden;
	color: #707b73;
	font-size: 10px;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.today-meal.arranged .today-meal-name {
	color: #385e3e;
	font-weight: 700;
}

.today-plan-empty {
	display: flex;
	justify-content: space-between;
	margin-top: 18rpx;
	padding-top: 16rpx;
	border-top: 1rpx solid #e5eee7;
	color: #89948c;
	font-size: 11px;
}

.today-plan-add {
	color: #4b9f58;
	font-weight: 700;
}

.menu {
	border: 1rpx solid #edf1ef;
	border-radius: 16px;
	background: #fff;
}

.menu-item {
	display: grid;
	grid-template-columns: 50rpx 1fr auto;
	gap: 14rpx;
	align-items: center;
	padding: 20rpx 12rpx 20rpx 17px;
	border-bottom: 1rpx solid #eff3f1;
	font-size: 15px;
}

.contact-item {
	width: 100%;
	background: #fff;
	color: #1f2a22;
	text-align: left;
}

.contact-item::after {
	border: none;
}

.menu-item:last-child {
	border-bottom: none;
}

.menu-item.group-end {
	border-bottom: none;
}

.menu-sep {
	height: 24rpx;
	position: relative;
}

.menu-sep::after {
	content: '';
	position: absolute;
	left: 18px;
	right: 12px;
	top: 50%;
	height: 1rpx;
	background: #e9eeeb;
	transform: translateY(-50%);
}

.micon {
	font-family: "iconfont" !important;
	font-style: normal;
	font-weight: 400;
	color: #34a853;
	font-size: 23px;
	text-align: center;
	line-height: 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.arrow {
	font-size: 28px;
	color: #c7ced9;
	line-height: 1;
}
</style>
