<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top" :style="{ paddingRight: `${navRightGap}px` }">
			<text class="top-title">鲜食档案</text>
		</view>

		<view class="stats">
			<view class="stat s-green">
				<text class="num">{{ stats.total }}</text>
				<text class="title">库存总数</text>
				<text class="sub">{{ stats.fresh }}个新鲜</text>
			</view>
			<view class="stat s-orange">
				<text class="num">{{ stats.expiring }}</text>
				<text class="title">已过期/即将过期</text>
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
			<view v-if="isLoading" class="row">
				<view class="ico">
					<IngredientIcon name="冰箱" category="其他" :size="34" />
				</view>
				<view class="body">
					<text class="name">正在加载...</text>
					<text class="meta">正在同步最新食材数据</text>
				</view>
				<text class="tag ok">加载中</text>
			</view>
			<view v-else-if="latestIngredients.length === 0" class="row">
				<view class="ico">
					<IngredientIcon name="冰箱" category="其他" :size="34" />
				</view>
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
				<text class="tip-ico home-iconfont">&#xe62f;</text>
				<text class="tip-title">{{ tip.title }}</text>
			</view>
			<text class="tip-text">{{ tip.text }}</text>
			<view class="tip-tags">
				<text v-for="tag in tip.tags" :key="tag" class="tip-pill">{{ tag }}</text>
			</view>
		</view>

		<view class="assistant-entry" @click="goAssistant">
			<view class="assistant-figure">
				<image class="assistant-mascot" src="/static/assistant/fridge-assistant.png" mode="aspectFit"></image>
			</view>
			<view class="assistant-bubble">
				<text class="assistant-title">Hi，我是你的语音助手</text>
				<text class="assistant-arrow">›</text>
			</view>
		</view>
		<BottomNav current="home" />
	</view>
</template>

<script>
import { getIngredientList } from '@/api/modules/ingredients'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'

const HOME_INGREDIENT_CACHE_KEY = 'FFA_HOME_INGREDIENTS_CACHE'

export default {
	components: { BottomNav, IngredientIcon },
	data() {
		return {
			safeTop: 20,
			isLoading: true,
			stats: {
				total: 0,
				fresh: 0,
				expiring: 0
			},
			latestIngredients: [],
			tip: {
				title: '今日饮食建议',
				text: '优先消耗冷藏区食材，午晚餐按“蔬菜 + 蛋白 + 粗粮”搭配；少盐少油，饮水不少于 1500ml。',
				tags: ['高纤维', '低盐', '优先临期']
			}
		}
	},
	onLoad() {
		this.ensureShareMenu()
		try {
			const info = uni.getSystemInfoSync()
			const top = Number(info?.statusBarHeight || 0)
			if (Number.isFinite(top) && top > 0) this.safeTop = top
		} catch (e) {}
		this.hydrateFromCache()
	},
	onShow() {
		this.ensureShareMenu()
		this.refreshData()
	},
	onShareAppMessage() {
		const total = Number(this.stats?.total || 0)
		const expiring = Number(this.stats?.expiring || 0)
		const title = total > 0
			? `我的冰箱有 ${total} 项食材${expiring > 0 ? `，其中 ${expiring} 项临期` : ''}，一起管理更省心`
			: '我在鲜食档案管理冰箱食材，推荐你也试试'
		return {
			title,
			path: '/pages/home/index'
		}
	},
	onShareTimeline() {
		return {
			title: '鲜食档案 | 冰箱食材管理与临期提醒'
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
		hydrateFromCache() {
			try {
				const cached = uni.getStorageSync(HOME_INGREDIENT_CACHE_KEY)
				const list = Array.isArray(cached) ? cached : []
				if (!list.length) return
				this.applyList(list)
				this.isLoading = false
			} catch (_) {}
		},
		persistCache(list) {
			try {
				uni.setStorageSync(HOME_INGREDIENT_CACHE_KEY, Array.isArray(list) ? list : [])
			} catch (_) {}
		},
		extractList(res) {
			if (Array.isArray(res)) return res
			if (Array.isArray(res?.data)) return res.data
			if (Array.isArray(res?.data?.data)) return res.data.data
			return []
		},
		applyList(list) {
			const safeList = Array.isArray(list) ? list : []
			const total = safeList.length
			const now = new Date()
			now.setHours(0, 0, 0, 0)
			const threeDaysMs = 3 * 24 * 60 * 60 * 1000
			const expiring = safeList.filter((item) => {
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
			this.latestIngredients = [...safeList].sort((a, b) => toTs(a) - toTs(b)).slice(0, 3)
			this.tip = this.buildSmartTip(safeList)
		},
		async refreshData() {
			try {
				const res = await getIngredientList()
				const list = this.extractList(res)
				this.applyList(list)
				this.persistCache(list)
			} catch (e) {
				if (!this.latestIngredients.length) {
					uni.showToast({ title: '首页加载失败', icon: 'none' })
				}
			} finally {
				this.isLoading = false
			}
		},
		buildSmartTip(list) {
			const items = Array.isArray(list) ? list : []
			if (!items.length) {
				return {
					title: '先补一点常用食材',
					text: '当前库存较少，建议先补充 2-3 种基础食材（如鸡蛋、番茄、绿叶菜），更容易快速做出一餐。',
					tags: ['先补库存', '基础食材', '省时做饭']
				}
			}

			const expired = items.filter((x) => this.getDays(x.expireDate) < 0)
			if (expired.length) {
				const names = [...new Set(expired.map((x) => x.name).filter(Boolean))].slice(0, 3).join('、')
				return {
					title: '先检查过期食材',
					text: `发现 ${expired.length} 项可能已过期${names ? `（${names}）` : ''}，建议先核对状态并优先清理，避免误食。`,
					tags: ['食品安全', '先清理', '避免浪费']
				}
			}

			const expiringSoon = items.filter((x) => {
				const d = this.getDays(x.expireDate)
				return d >= 0 && d <= 2
			})
			if (expiringSoon.length) {
				const names = [...new Set(expiringSoon.map((x) => x.name).filter(Boolean))].slice(0, 3).join('、')
				return {
					title: '优先消耗临期食材',
					text: `${expiringSoon.length} 项食材 2 天内到期${names ? `（${names}）` : ''}，建议今晚优先使用，减少损耗。`,
					tags: ['优先临期', '今晚先做', '减少浪费']
				}
			}

			const countByCategory = items.reduce((acc, x) => {
				const key = `${x?.category || '其他'}`
				acc[key] = (acc[key] || 0) + 1
				return acc
			}, {})
			const vegCount = (countByCategory['蔬菜'] || 0) + (countByCategory['水果'] || 0)
			const proteinCount = (countByCategory['肉类'] || 0) + (countByCategory['蛋奶'] || 0) + (countByCategory['海鲜'] || 0)

			if (vegCount === 0) {
				return {
					title: '建议补充蔬果',
					text: '当前库存缺少蔬果，建议下次采购补 1-2 种绿叶菜或高纤维蔬果，搭配会更均衡。',
					tags: ['补蔬果', '高纤维', '均衡饮食']
				}
			}
			if (proteinCount === 0) {
				return {
					title: '建议补充蛋白来源',
					text: '当前库存蛋白类偏少，可补充鸡蛋、豆制品或瘦肉，日常做菜更容易搭配。',
					tags: ['补蛋白', '营养均衡', '更好搭配']
				}
			}

			return {
				title: '库存状态良好',
				text: '当前食材结构较均衡，继续按“蔬菜 + 蛋白 + 主食”搭配即可，做饭效率和营养都会更稳定。',
				tags: ['结构均衡', '按需消耗', '保持节奏']
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
			if (days < 0) return `过期${Math.abs(days)}天`
			if (days === 0) return '今天过期'
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
			uni.redirectTo({
				url: '/pages/fridge/list',
				fail: () => {
					uni.reLaunch({ url: '/pages/fridge/list' })
				}
			})
		},
		goAssistant() {
			uni.navigateTo({
				url: '/pages/assistant/index',
				fail: () => {
					uni.redirectTo({ url: '/pages/assistant/index' })
				}
			})
		}
	}
}
</script>

<style scoped>
.container {
	padding: 0 12px 88px;
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

.assistant-entry {
	display: flex;
	align-items: center;
	gap: 4rpx;
	margin: 28rpx 2rpx 18rpx;
	padding: 4rpx 8rpx 4rpx 0;
}

.assistant-title {
	color: #26352d;
	font-size: 13px;
	font-weight: 700;
}

.assistant-figure {
	width: 128rpx;
	height: 108rpx;
	overflow: hidden;
	flex-shrink: 0;
}

.assistant-mascot {
	width: 128rpx;
	height: 108rpx;
	transform: scale(1.72);
}

.assistant-bubble {
	position: relative;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 14rpx;
	min-height: 68rpx;
	padding: 0 18rpx 0 22rpx;
	border: 1rpx solid #dfe6e2;
	border-radius: 16px;
	background: #fff;
	box-shadow: 0 7rpx 17rpx rgba(30, 50, 34, .07);
}

.assistant-bubble::before {
	content: '';
	position: absolute;
	left: -10rpx;
	top: 24rpx;
	width: 18rpx;
	height: 18rpx;
	border-left: 1rpx solid #dfe6e2;
	border-bottom: 1rpx solid #dfe6e2;
	background: #fff;
	transform: rotate(45deg);
}

.assistant-arrow {
	color: #a7b3ac;
	font-size: 20px;
	line-height: 1;
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
	font-family: "iconfont" !important;
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
	background: #ffffff;
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
	background: #f8fbff;
	font-size: 40rpx;
}

.empty-ico-font {
	width: 34px;
	height: 34px;
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
	font-weight: 700;
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
	background: rgba(255, 255, 255, 0.28);
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 36rpx;
	color: #ffffff;
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
