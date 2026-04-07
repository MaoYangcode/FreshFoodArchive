<template>
	<view class="container">
		<view class="top">
			<text class="top-title">鲜食档案</text>
			<view class="capsule"><text>•••</text><text>◉</text></view>
		</view>
		<view class="stats">
			<view class="stat s-green">
				<text class="num">{{ stats.total }}</text>
				<text class="title">库存总数</text>
				<text class="sub">{{ stats.fresh }}个新鲜</text>
			</view>
			<view class="stat s-orange">
				<text class="num">{{ stats.expiring }}</text>
				<text class="title">即将过期</text>
				<text class="sub">请尽快处理</text>
			</view>
		</view>

		<view class="section">
			<view class="section-title-wrap">
				<text>优先提醒</text>
				<text class="home-iconfont warn-ico">&#xe629;</text>
			</view>
			<text class="green-link" @click="goFridge">查看全部</text>
		</view>

		<view class="card">
			<view v-if="latestIngredients.length === 0" class="row">
				<view class="ico">🧊</view>
				<view class="body">
					<text class="name">还没有食材</text>
					<text class="meta">去添加页录入第一条食材吧</text>
				</view>
				<text class="tag ok">空</text>
			</view>
			<view v-for="item in latestIngredients" :key="item.id" class="row">
				<view class="ico">
					<IngredientIcon :name="item.name" :category="item.category" :size="40" />
				</view>
				<view class="body">
					<text class="name">{{ item.name }}</text>
					<text class="meta">{{ item.quantity }}{{ item.unit }} · {{ item.category }} · {{ item.location }}</text>
				</view>
				<text class="tag" :class="getTagClass(item.expireDate)">{{ getTagText(item.expireDate) }}</text>
			</view>
		</view>

		<view class="section">
			<text>小贴士</text>
			<text></text>
		</view>
		<view class="tip-card">
			<view class="tip-head">
				<text class="tip-ico">🥗</text>
				<text class="tip-title">今日饮食建议</text>
			</view>
			<text class="tip-text">优先消耗冷藏区食材，午晚餐按“蔬菜 + 蛋白 + 粗粮”搭配；少盐少油，饮水不少于 1500ml。</text>
			<view class="tip-tags">
				<text class="tip-pill">高纤维</text>
				<text class="tip-pill">低盐</text>
				<text class="tip-pill">优先临期</text>
			</view>
		</view>
		<BottomNav current="home" />
	</view>
</template>

<script>
import { getIngredientList } from '@/api/modules/ingredients'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'

export default {
	components: { BottomNav, IngredientIcon },
	data() {
		return {
			stats: {
				total: 0,
				fresh: 0,
				expiring: 0
			},
			latestIngredients: []
		}
	},
	onShow() {
		this.refreshData()
	},
	methods: {
		async refreshData() {
			try {
				const res = await getIngredientList()
				const list = Array.isArray(res)
					? res
					: (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []))
				const total = list.length
				const now = new Date()
				now.setHours(0, 0, 0, 0)
				const threeDaysMs = 3 * 24 * 60 * 60 * 1000
				const expiring = list.filter((item) => {
					const t = new Date(item.expireDate).getTime()
					if (!Number.isFinite(t)) return false
					return t - now.getTime() <= threeDaysMs
				}).length
				const fresh = Math.max(total - expiring, 0)
				this.stats = { total, fresh, expiring }
				const toTs = (item) => {
					const t = new Date(item.expireDate).getTime()
					return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY
				}
				this.latestIngredients = [...list].sort((a, b) => toTs(a) - toTs(b)).slice(0, 3)
			} catch (e) {
				this.stats = { total: 0, fresh: 0, expiring: 0 }
				this.latestIngredients = []
				uni.showToast({ title: '首页加载失败', icon: 'none' })
			}
		},
		getTagClass(expireDate) {
			const days = this.getDays(expireDate)
			if (days <= 0) return 'bad'
			if (days <= 2) return 'warn'
			return 'ok'
		},
		getTagText(expireDate) {
			const days = this.getDays(expireDate)
			if (days <= 0) return `过期${Math.abs(days)}天`
			if (days <= 2) return `剩${days}天`
			return '新鲜'
		},
		getDays(expireDate) {
			const now = new Date()
			now.setHours(0, 0, 0, 0)
			const t = new Date(expireDate)
			t.setHours(0, 0, 0, 0)
			return Math.floor((t.getTime() - now.getTime()) / (24 * 3600 * 1000))
		},
		goFridge() {
			uni.switchTab({ url: '/pages/fridge/list' })
		}
	}
}
</script>

<style scoped>
@font-face {
	font-family: "home-iconfont";
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

.stats {
	display: flex;
	gap: 16rpx;
	margin-bottom: 16rpx;
}

.stat {
	flex: 1;
	border-radius: 16px;
	padding: 18rpx 20rpx;
	display: flex;
	flex-direction: column;
	min-height: 230rpx;
	color: #fff;
}

.s-green {
	background: linear-gradient(135deg, #5fc162, #4eb657);
}

.s-orange {
	background: linear-gradient(135deg, #f4ad3d, #ef9b20);
}

.num {
	font-size: 48px;
	font-weight: 700;
	line-height: 1;
}

.title {
	font-size: 12px;
	margin-top: 8rpx;
}

.sub {
	font-size: 12px;
	margin-top: auto;
	background: rgba(255, 255, 255, 0.24);
	border: 1rpx solid rgba(255, 255, 255, 0.36);
	padding: 6rpx 14rpx;
	border-radius: 999rpx;
	align-self: flex-start;
}

.section {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-size: 14px;
	font-weight: 700;
	margin: 8rpx 4rpx 10rpx;
}

.section-title-wrap {
	display: inline-flex;
	align-items: center;
	gap: 6rpx;
}

.home-iconfont {
	font-family: "home-iconfont" !important;
	font-style: normal;
	font-weight: 400;
	line-height: 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.warn-ico {
	font-size: 16px;
	color: #223a33;
}

.green-link {
	color: #4eb55a;
	font-size: 12px;
}

.card {
	background: #fff;
	border: 1rpx solid #edf2ef;
	border-radius: 16px;
	padding: 12px;
	box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07);
	margin-bottom: 16rpx;
}

.row {
	display: grid;
	grid-template-columns: 72rpx 1fr auto;
	gap: 14rpx;
	align-items: center;
	border: 1rpx solid #eef3f0;
	border-radius: 14px;
	padding: 8px;
	margin-bottom: 10rpx;
	background: #fbfdfb;
}

.row:last-child {
	margin-bottom: 0;
}

.ico {
	width: 40px;
	height: 40px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f1f8f2;
	font-size: 40rpx;
}

.body {
	display: flex;
	flex-direction: column;
	margin-left: 6rpx;
}

.name {
	font-size: 14px;
	font-weight: 700;
}

.meta {
	display: block;
	font-size: 12px;
	color: #738177;
	margin-top: 4rpx;
}

.tag {
	border-radius: 999rpx;
	font-size: 11px;
	padding: 4rpx 12rpx;
}

.ok {
	background: #e9f8ec;
	color: #3f9f4d;
}

.warn {
	background: #fff0db;
	color: #c97e1e;
}

.bad {
	background: #fde9e9;
	color: #ce5454;
}

.tip-card {
	background: linear-gradient(135deg, #4e7dff, #6390ff);
	border-radius: 16px;
	padding: 14px;
	margin-bottom: 10rpx;
}

.tip-head {
	display: flex;
	align-items: center;
	gap: 10rpx;
	margin-bottom: 10rpx;
}

.tip-ico {
	width: 46rpx;
	height: 46rpx;
	border-radius: 50%;
	background: rgba(255, 255, 255, 0.2);
	display: flex;
	align-items: center;
	justify-content: center;
}

.tip-title {
	color: #fff;
	font-weight: 700;
	font-size: 14px;
}

.tip-text {
	color: #f3f7ff;
	font-size: 14px;
	line-height: 1.7;
}

.tip-tags {
	display: flex;
	gap: 8rpx;
	margin-top: 12rpx;
	flex-wrap: wrap;
}

.tip-pill {
	color: #fff;
	background: rgba(255, 255, 255, 0.18);
	padding: 4rpx 10rpx;
	border-radius: 999rpx;
	font-size: 11px;
}
</style>
