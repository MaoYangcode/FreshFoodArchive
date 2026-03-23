<template>
	<view class="container" @click="closeSwipe">
		<view class="top">
			<text class="top-title">我的冰箱</text>
			<view class="capsule"><text>🔎</text></view>
		</view>
		<input
			class="search"
			type="text"
			v-model.trim="keyword"
			placeholder="搜索食材名称（可与位置、类别组合筛选）"
		/>
		<view class="location-wrap">
			<view class="chips location-chips">
				<button
					v-for="loc in locations"
					:key="loc"
					class="chip"
					:class="{ active: selectedLocation === loc }"
					@click.stop="selectedLocation = loc"
				>
					{{ loc }}
				</button>
			</view>
		</view>
		<view class="chips">
			<button
				v-for="cat in categories"
				:key="cat"
				class="chip"
				:class="{ active: selectedCategory === cat }"
				@click.stop="selectedCategory = cat"
			>
				{{ cat }}
			</button>
		</view>
		<text class="status filter-summary">当前筛选：{{ selectedLocation }} · {{ selectedCategory }}（{{ filteredList.length }}）</text>

		<view v-if="filteredList.length === 0" class="card empty">
			<text class="empty-icon">🧊</text>
			<text class="empty-title">没有符合条件的食材</text>
			<text class="empty-sub">换个关键词或者切换位置/类别试试</text>
		</view>

		<view v-else class="card">
			<view v-for="item in filteredList" :key="item.id" class="swipe-item">
				<view class="swipe-action" @click.stop="consume(item)">已取出</view>
				<view
					class="row swipe-content"
					:class="{ open: openSwipeId === item.id }"
					@touchstart.stop="onTouchStart($event, item.id)"
					@touchmove.stop="onTouchMove($event)"
					@touchend.stop="onTouchEnd($event, item.id)"
					@mousedown.stop="onMouseDown($event, item.id)"
					@wheel.stop="onWheel($event, item.id)"
					@dblclick.stop="onDoubleClick(item.id)"
					@longpress.stop="onLongPress(item.id)"
					@longtap.stop="onLongPress(item.id)"
					@contextmenu.prevent.stop="onContextMenu(item.id)"
					@click.stop="onRowClick(item)"
				>
					<view class="ico">{{ getEmoji(item.category) }}</view>
					<view class="body">
						<text class="name">{{ item.name }}</text>
						<text class="meta">{{ item.quantity }}{{ item.unit }} · {{ item.category }} · {{ item.location }}</text>
					</view>
					<text class="tag" :class="getTagClass(item.expireDate)">{{ getTagText(item.expireDate) }}</text>
				</view>
			</view>
		</view>
		<button class="add-btn" @click="goAdd">+ 新增食材</button>
		<BottomNav current="fridge" />
	</view>
</template>

<script>
	
import { getIngredientList ,consumeIngredient } from '@/api/modules/ingredients'
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			keyword: '',
			locations: ['全部位置', '冷藏', '冷冻', '常温'],
			categories: ['全部类别', '蔬菜', '水果', '肉类', '蛋奶', '其他'],
			selectedLocation: '全部位置',
			selectedCategory: '全部类别',
			list: [],
			openSwipeId: '',
			touchStartX: 0,
			touchStartY: 0,
			touchDeltaX: 0,
			touchDeltaY: 0,
			mouseStartX: 0,
			mouseStartY: 0,
			mouseDownId: '',
			mouseMoveX: 0,
			mouseMoveY: 0,
			mouseDragging: false,
			preventNextClick: false,
			mousePressTimer: null,
			isDesktop: true,
			lastTouchAt: 0
		}
	},
	onLoad() {
		try {
			const platform = uni.getSystemInfoSync().platform || ''
			this.isDesktop = platform === 'windows' || platform === 'mac'
		} catch (e) {
			this.isDesktop = true
		}
	},
	mounted() {
		window.addEventListener('mousemove', this.onWindowMouseMove)
		window.addEventListener('mouseup', this.onWindowMouseUp)
	},
	beforeUnmount() {
		window.removeEventListener('mousemove', this.onWindowMouseMove)
		window.removeEventListener('mouseup', this.onWindowMouseUp)
	},
	onUnload() {
		window.removeEventListener('mousemove', this.onWindowMouseMove)
		window.removeEventListener('mouseup', this.onWindowMouseUp)
	},
	onShow() {
		this.refreshList()
	},
	computed: {
		filteredList() {
			return this.list.filter((item) => {
				const locationHit = this.selectedLocation === '全部位置' || item.location === this.selectedLocation
				const categoryHit = this.selectedCategory === '全部类别' || item.category === this.selectedCategory
				const keywordHit = !this.keyword || item.name.includes(this.keyword)
				return locationHit && categoryHit && keywordHit
			})
		}
	},
	methods: {
		async refreshList() {
			try {
				const res = await getIngredientList()
				this.list = Array.isArray(res) ? res : []
			} catch (e) {
				console.error('获取失败', e)
				uni.showToast({
					title: '加载失败',
					icon: 'none'
				})
				this.list = []
			}
		},
	
		getEmoji(category) {
			const map = {
				蔬菜: '🥦',
				水果: '🥑',
				肉类: '🍗',
				蛋奶: '🧀',
				调料: '🧂',
				其他: '🍽️'
			}
			return map[category] || '🍽️'
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
			if (!expireDate) return 999
			const now = new Date()
			now.setHours(0, 0, 0, 0)
			const t = new Date(expireDate)
			t.setHours(0, 0, 0, 0)
			return Math.floor((t.getTime() - now.getTime()) / (24 * 3600 * 1000))
		},
		onTouchStart(e, id) {
			this.lastTouchAt = Date.now()
			this.touchStartX = e.touches[0].clientX
			this.touchStartY = e.touches[0].clientY
			this.touchDeltaX = 0
			this.touchDeltaY = 0
			if (this.openSwipeId && this.openSwipeId !== id) {
				this.openSwipeId = ''
			}
		},
		onTouchMove(e) {
			const x = e.touches[0].clientX
			const y = e.touches[0].clientY
			this.touchDeltaX = x - this.touchStartX
			this.touchDeltaY = y - this.touchStartY
		},
		onTouchEnd(e, id) {
			const endX = e.changedTouches[0].clientX
			const deltaX = this.touchDeltaX || endX - this.touchStartX
			const deltaY = this.touchDeltaY
			const horizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
			if (horizontalSwipe && deltaX < -35) {
				this.openSwipeId = id
				return
			}
			if (horizontalSwipe && deltaX > 35) {
				this.openSwipeId = ''
			}
		},
		onMouseDown(e, id) {
			if (e.button !== 0) return
			this.mouseDownId = id
			this.mouseStartX = e.clientX
			this.mouseStartY = e.clientY
			this.mouseMoveX = 0
			this.mouseMoveY = 0
			this.mouseDragging = false
			clearTimeout(this.mousePressTimer)
			this.mousePressTimer = setTimeout(() => {
				if (!this.mouseDragging && this.mouseDownId === id) {
					this.openSwipeId = id
					this.preventNextClick = true
				}
			}, 350)
			if (this.openSwipeId && this.openSwipeId !== id) {
				this.openSwipeId = ''
			}
		},
		onWindowMouseMove(e) {
			if (!this.mouseDownId) return
			this.mouseMoveX = e.clientX - this.mouseStartX
			this.mouseMoveY = e.clientY - this.mouseStartY
			const deltaX = this.mouseMoveX
			const deltaY = this.mouseMoveY
			const horizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY)
			if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
				this.mouseDragging = true
				clearTimeout(this.mousePressTimer)
			}
			if (horizontalSwipe && deltaX < -28) {
				this.openSwipeId = this.mouseDownId
				this.preventNextClick = true
			} else if (horizontalSwipe && deltaX > 28) {
				this.openSwipeId = ''
				this.preventNextClick = true
			}
		},
		onWindowMouseUp() {
			clearTimeout(this.mousePressTimer)
			if (this.mouseDragging) {
				this.preventNextClick = true
			}
			this.mouseDownId = ''
			this.mouseDragging = false
		},
		onWheel(e, id) {
			if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || Math.abs(e.deltaX) < 8) return
			if (e.deltaX > 0) {
				this.openSwipeId = id
				this.preventNextClick = true
				return
			}
			this.openSwipeId = ''
			this.preventNextClick = true
		},
		onDoubleClick(id) {
			this.openSwipeId = this.openSwipeId === id ? '' : id
			this.preventNextClick = true
		},
		onContextMenu(id) {
			this.openSwipeId = id
			this.preventNextClick = true
		},
		onLongPress(id) {
			this.openSwipeId = id
			this.preventNextClick = true
		},
		closeSwipe() {
			this.openSwipeId = ''
		},
		onRowClick(item) {
			if (this.preventNextClick) {
				this.preventNextClick = false
				return
			}
			// Reliable desktop fallback: non-touch click opens action first.
			const fromTouch = Date.now() - this.lastTouchAt < 500
			if (!fromTouch) {
				if (this.openSwipeId !== item.id) {
					this.openSwipeId = item.id
					return
				}
				this.goEdit(item)
				return
			}
			if (this.openSwipeId === item.id) {
				this.openSwipeId = ''
				return
			}
			this.goEdit(item)
		},
		goEdit(item) {
			uni.navigateTo({
				url: `/pages/fridge/edit?id=${item.id}`
			})
		},

		goAdd() {
			uni.switchTab({ url: '/pages/fridge/add' })
		},
		async consume(item) {
			try {
				await consumeIngredient(item.id, {
					quantity: 1
				})
		
				this.openSwipeId = ''
		
				uni.showToast({
					title: '已取出 1 份',
					icon: 'success'
				})
		
				this.refreshList()
			} catch (e) {
				console.error('取出失败', e)
				uni.showToast({
					title: '取出失败',
					icon: 'none'
				})
			}
		},
	}
}
</script>

<style scoped>
.container {
	padding: 14px 12px 92px;
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

.card {
	background: #fff;
	border: 1rpx solid #eef0f1;
	border-radius: 18px;
	padding: 14px 12px;
	margin-bottom: 14rpx;
	box-shadow: 0 8rpx 20rpx rgba(18, 37, 63, 0.05);
}

.search {
	display: block;
	width: 100%;
	border: 1rpx solid #e8ebee;
	border-radius: 14px;
	background: #fff;
	color: #404b57;
	font-size: 13px;
	padding: 10px 14px;
	box-sizing: border-box;
	margin-bottom: 16rpx;
}

.location-wrap {
	background: #fff;
	border: 1rpx solid #ebedf0;
	border-radius: 999rpx;
	padding: 4px;
	margin-bottom: 12rpx;
}

.chips {
	display: flex;
	gap: 8rpx;
	flex-wrap: wrap;
	margin-bottom: 12rpx;
}

.location-chips {
	display: grid;
	grid-template-columns: repeat(4, minmax(0, 1fr));
	gap: 6rpx;
}

.chip {
	border: 1rpx solid #e6e9ed;
	background: #fff;
	color: #60707f;
	border-radius: 999rpx;
	padding: 6rpx 14rpx;
	font-size: 12px;
	line-height: 1.2;
	min-height: 56rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}

.location-chips .chip {
	width: 100%;
	padding: 10rpx 0;
	border: 1rpx solid transparent;
	font-size: 13px;
	font-weight: 600;
}

.chip.active {
	background: linear-gradient(135deg, #70c977, #4cae57);
	color: #fff;
	border-color: transparent;
}

.location-chips .chip.active {
	background: linear-gradient(135deg, #6ea7f2, #4f8fe8);
	box-shadow: 0 4rpx 10rpx rgba(79, 143, 232, 0.24);
}

.chip::after {
	border: none;
}

.filter-summary {
	display: block;
	font-size: 12px;
	color: #66707c;
	margin: 2rpx 2rpx 12rpx;
}

.name {
	font-size: 16px;
	font-weight: 700;
	color: #1f2329;
}

.meta {
	display: block;
	font-size: 13px;
	color: #727c88;
	margin-top: 4rpx;
}

.empty {
	min-height: 420rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	border: 1rpx dashed #dbe5df;
	background: linear-gradient(180deg, #fbfdfc, #f6faf8);
}

.empty-icon {
	font-size: 92rpx;
}

.empty-title {
	font-size: 16px;
	font-weight: 600;
	margin-top: 12rpx;
}

.empty-sub {
	font-size: 12px;
	color: #6b7280;
	margin-top: 8rpx;
}

.swipe-item {
	position: relative;
	overflow: hidden;
	border-radius: 16px;
	margin-bottom: 10rpx;
}

.swipe-item:last-child {
	margin-bottom: 0;
}

.swipe-action {
	position: absolute;
	right: 0;
	top: 0;
	bottom: 0;
	width: 98px;
	background: linear-gradient(135deg, #83b4ff, #5f95f2);
	opacity: 0.9;
	color: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 13px;
	font-weight: 700;
}

.swipe-content {
	position: relative;
	transition: transform 0.2s ease;
}

.swipe-content.open {
	transform: translateX(-98px);
}

.row {
	display: grid;
	grid-template-columns: 78rpx 1fr auto;
	gap: 14rpx;
	align-items: center;
	border: 1rpx solid #eceff2;
	border-radius: 16px;
	padding: 12px 10px;
	background: #ffffff;
}

.ico {
	width: 42px;
	height: 42px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f4f8f5;
	font-size: 38rpx;
}

.body {
	display: flex;
	flex-direction: column;
}

.tag {
	border-radius: 999rpx;
	font-size: 11px;
	padding: 5rpx 13rpx;
	font-weight: 600;
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

.add-btn {
	width: 100%;
	border: none;
	border-radius: 14px;
	padding: 12px 12px;
	color: #fff;
	font-size: 14px;
	font-weight: 700;
	background: linear-gradient(135deg, #70c977, #4cae57);
	box-shadow: 0 8rpx 16rpx rgba(58, 116, 66, 0.22);
}

.status {
	user-select: none;
}
</style>
