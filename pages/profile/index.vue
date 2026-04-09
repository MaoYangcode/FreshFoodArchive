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
			<view class="menu-item">
				<text class="micon">&#xe631;</text>
				<text>问题反馈</text>
				<text class="arrow">›</text>
			</view>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { getProfile } from '@/api/modules/profile'
import { getCurrentUserId } from '@/utils/current-user'

export default {
	components: { BottomNav },
	data() {
		return {
			userId: getCurrentUserId(),
			profileName: '微信用户',
			profileAvatar: ''
		}
	},
	onShow() {
		this.userId = getCurrentUserId()
		this.loadProfileHeader()
	},
	methods: {
		async loadProfileHeader() {
			try {
				const res = await getProfile(this.userId)
				this.profileName = `${res?.name || '微信用户'}`.trim() || '微信用户'
				this.profileAvatar = `${res?.avatar || ''}`.trim()
			} catch (e) {
				this.profileName = '微信用户'
				this.profileAvatar = ''
			}
		},
		goFridge() {
			uni.navigateTo({
				url: '/pages/fridge/shelf-life'
			})
		},
		goFavorites() {
			uni.navigateTo({ url: '/pages/profile/favorites' })
		},
		goTakeout() {
			uni.navigateTo({ url: '/pages/profile/takeout-records' })
		},
		goBasket() {
			uni.navigateTo({ url: '/pages/profile/basket' })
		},
		goExpiryReminder() {
			uni.navigateTo({ url: '/pages/profile/expiry-reminder' })
		},
		goProfile() {
			uni.navigateTo({ url: '/pages/profile/profile' })
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
