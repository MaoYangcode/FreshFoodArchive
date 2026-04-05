<template>
	<view class="container" @click.self="closeSwipe">
		<view class="top">
			<text class="top-title">我的冰箱</text>
			<view class="capsule"><text>🔎</text></view>
		</view>
		<view class="location-wrap">
			<view class="chips location-chips">
				<button
					v-for="loc in locations"
					:key="loc"
					class="chip"
					:class="{ active: selectedLocation === loc }"
					@click.stop="selectedLocation = loc"
				>
					<view class="loc-chip">
						<LocationIcon v-if="loc !== '全部位置'" :location="loc" :size="18" color="#8fb7e8" />
						<text>{{ loc }}</text>
					</view>
				</button>
			</view>
		</view>
		<view class="chips category-chips">
			<button
				v-for="cat in categories"
				:key="cat"
				class="chip category-chip"
				:class="{ active: isCategorySelected(cat), 'all-category-chip': cat === '全部类别' }"
				@click.stop="toggleCategory(cat)"
			>
				<text>{{ cat }}</text>
				<text v-if="cat !== '全部类别'" class="chip-count">{{ categoryCounts[cat] || 0 }}</text>
			</button>
		</view>
		<view class="summary-row">
			<view class="search-wrap">
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
			<FridgeViewControls
				:viewMode="viewMode"
				:sortDirection="sortDirection"
				@toggle-view="toggleFridgeView"
				@toggle-sort="toggleSortMode"
			/>
		</view>

		<view v-if="filteredList.length === 0" class="card empty">
			<svg v-if="emptySymbolReady" class="empty-icon-svg" aria-hidden="true">
				<use href="#icon-bingxiang"></use>
			</svg>
			<text v-else class="empty-icon">🧊</text>
			<text class="empty-title">没有符合条件的食材</text>
			<text class="empty-sub">换个关键词或者切换位置/类别试试</text>
		</view>

		<view v-else :class="viewMode === 'list' ? 'card' : 'tiles-wrap'">
			<view v-if="viewMode === 'list'">
				<view v-for="item in filteredList" :key="item.id" class="swipe-item">
					<view class="swipe-action" @click.stop="openConsumeDialog(item)">已取出</view>
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
						<view class="ico">
							<IngredientIcon :name="item.name" :category="item.category" :size="46" />
						</view>
						<view class="body">
							<text class="name">{{ item.name }}</text>
							<view class="meta">
								<text>{{ item.quantity }}{{ item.unit }} · {{ item.category }} · </text>
								<LocationIcon :location="item.location" :size="14" color="#8fb7e8" />
								<text>{{ item.location }}</text>
							</view>
						</view>
						<text class="tag" :class="getTagClass(item.expireDate)">{{ getTagText(item.expireDate) }}</text>
					</view>
				</view>
			</view>
			<view v-else class="grid">
				<view v-for="item in filteredList" :key="`tile-${item.id}`" class="tile" @click.stop="goEdit(item)">
					<view class="tile-inner">
						<text class="qty-badge">{{ formatQty(item) }}</text>
						<view class="tile-ico">
							<IngredientIcon :name="item.name" :category="item.category" :size="40" />
						</view>
						<view class="tile-right">
							<view class="tile-head">
								<text class="tile-name">{{ item.name }}</text>
							</view>
							<view class="fresh-row">
								<LocationIcon :location="item.location" :size="14" color="#8fb7e8" />
								<text class="tile-meta">{{ item.location }}</text>
							</view>
							<view class="bar-track">
								<view class="bar-fill" :style="barStyle(item.expireDate)"></view>
							</view>
						</view>
					</view>
				</view>
			</view>
		</view>
		<view v-if="consumeDialogVisible" class="consume-mask" @click="closeConsumeDialog">
			<view class="consume-card" @click.stop>
				<text class="consume-title">食材取出数量</text>
				<view class="consume-line">
					<text class="consume-name">{{ formatConsumeName(pendingConsumeItem ? pendingConsumeItem.name : '') }}</text>
					<view class="qty-wrap">
						<button class="qty-btn" @click="changeConsumeQty(-1)">-</button>
						<input class="qty-input" type="number" v-model="consumeQty" @input="onConsumeQtyInput" @blur="normalizeConsumeQty" />
						<button class="qty-btn" @click="changeConsumeQty(1)">+</button>
						<text class="qty-unit">{{ pendingConsumeItem ? pendingConsumeItem.unit : '' }}</text>
					</view>
				</view>
				<view class="consume-actions">
					<button class="confirm-btn" @click="confirmConsume">取出</button>
					<button class="cancel-btn" @click="closeConsumeDialog">取消</button>
				</view>
			</view>
		</view>
		<BottomNav current="fridge" />
	</view>
</template>

<script>
	
import { getIngredientList ,consumeIngredient } from '@/api/modules/ingredients'
import BottomNav from '@/components/bottom-nav.vue'
import FridgeViewControls from '@/components/fridge-view-controls.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import LocationIcon from '@/components/location-icon.vue'

const ICONFONT_VERSION = '20260405-3'

const PINYIN_CHAR_MAP = {
	全: 'quan', 部: 'bu', 位: 'wei', 置: 'zhi', 类: 'lei', 别: 'bie',
	水: 'shui', 果: 'guo', 蔬: 'shu', 菜: 'cai', 肉: 'rou', 蛋: 'dan', 奶: 'nai', 海: 'hai', 鲜: 'xian',
	饮: 'yin', 料: 'liao', 调: 'tiao', 味: 'wei', 品: 'pin', 其: 'qi', 他: 'ta',
	冷: 'leng', 藏: 'cang', 冻: 'dong', 常: 'chang', 温: 'wen',
	苹: 'ping', 香: 'xiang', 蕉: 'jiao', 牛: 'niu', 西: 'xi', 兰: 'lan', 花: 'hua',
	椰: 'ye', 胡: 'hu', 萝: 'luo', 卜: 'bu', 鸡: 'ji', 胸: 'xiong', 黄: 'huang', 瓜: 'gua',
	生: 'sheng', 蘑: 'mo', 菇: 'gu', 面: 'mian', 条: 'tiao', 洋: 'yang', 葱: 'cong', 橙: 'cheng',
	子: 'zi', 猪: 'zhu', 土: 'tu', 豆: 'dou', 马: 'ma', 铃: 'ling', 薯: 'shu', 大: 'da',
	米: 'mi', 饭: 'fan', 虾: 'xia', 腐: 'fu', 番: 'fan', 茄: 'qie', 红: 'hong', 柿: 'shi',
	梨: 'li', 桃: 'tao', 柚: 'you', 橘: 'ju', 柑: 'gan', 葡: 'pu', 萄: 'tao', 柠: 'ning', 檬: 'meng',
	青: 'qing', 白: 'bai', 黑: 'hei', 玉: 'yu', 芹: 'qin', 蒜: 'suan', 姜: 'jiang', 葵: 'kui',
	南: 'nan', 笋: 'sun', 包: 'bao', 心: 'xin'
}

function buildPinyinIndex(text) {
	const raw = `${text || ''}`.toLowerCase()
	let full = ''
	let initials = ''
	for (const ch of raw) {
		if (/[a-z0-9]/.test(ch)) {
			full += ch
			initials += ch
			continue
		}
		const py = PINYIN_CHAR_MAP[ch]
		if (!py) continue
		full += py
		initials += py[0]
	}
	return { full, initials }
}

export default {
	components: { BottomNav, FridgeViewControls, IngredientIcon, LocationIcon },
	data() {
		return {
			keyword: '',
			locations: ['全部位置', '冷藏', '冷冻'],
			categories: ['全部类别', '水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			selectedLocation: '全部位置',
			selectedCategories: ['全部类别'],
			viewMode: 'list',
			sortDirection: 'asc',
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
			lastTouchAt: 0,
			consumeDialogVisible: false,
			consumeQty: 1,
			pendingConsumeItem: null,
			lastQtyLimitToastAt: 0,
			emptySymbolReady: false
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
		this.bindWindowEvents()
		this.ensureIconfontSymbol()
	},
	beforeUnmount() {
		this.unbindWindowEvents()
	},
	onUnload() {
		this.unbindWindowEvents()
	},
	onShow() {
		this.refreshList()
	},
	computed: {
		categoryCounts() {
			const rawKeyword = `${this.keyword || ''}`
			const keywordText = rawKeyword.trim().toLowerCase()
			const compactKeyword = keywordText.replace(/\s+/g, '')
			const tokens = keywordText.split(/\s+/).filter(Boolean)
			const counts = {}
			this.categories.forEach((cat) => {
				counts[cat] = 0
			})
			let total = 0
			this.list.forEach((item) => {
				const locationHit = this.selectedLocation === '全部位置' || item.location === this.selectedLocation
				const keywordHit = this.matchKeyword(item, compactKeyword, tokens)
				if (!locationHit || !keywordHit) return
				total += 1
				if (counts[item.category] !== undefined) {
					counts[item.category] += 1
				}
			})
			counts['全部类别'] = total
			return counts
		},
		filteredList() {
			const rawKeyword = `${this.keyword || ''}`
			const keywordText = rawKeyword.trim().toLowerCase()
			const compactKeyword = keywordText.replace(/\s+/g, '')
			const tokens = keywordText.split(/\s+/).filter(Boolean)
			const filtered = this.list.filter((item) => {
				const locationHit = this.selectedLocation === '全部位置' || item.location === this.selectedLocation
				const hasAll = this.selectedCategories.includes('全部类别')
				const categoryHit =
					hasAll || this.selectedCategories.length === 0 || this.selectedCategories.includes(item.category)
				const keywordHit = this.matchKeyword(item, compactKeyword, tokens)
				return locationHit && categoryHit && keywordHit
			})
			return [...filtered].sort((a, b) => {
				const ta = a && a.expireDate ? new Date(a.expireDate).getTime() : Number.POSITIVE_INFINITY
				const tb = b && b.expireDate ? new Date(b.expireDate).getTime() : Number.POSITIVE_INFINITY
				return this.sortDirection === 'asc' ? ta - tb : tb - ta
			})
		}
	},
	methods: {
		matchKeyword(item, compactKeyword, tokens) {
			if (!compactKeyword && (!tokens || !tokens.length)) return true
			const haystack = `${item?.name || ''} ${item?.category || ''} ${item?.location || ''}`.toLowerCase()
			const compactHaystack = haystack.replace(/\s+/g, '')
			const { full: pinyinFull, initials: pinyinInitials } = buildPinyinIndex(haystack)
			const fuzzyHit =
				!compactKeyword ||
				compactHaystack.includes(compactKeyword) ||
				pinyinFull.includes(compactKeyword) ||
				pinyinInitials.includes(compactKeyword) ||
				Array.from(compactKeyword).every((char) => compactHaystack.includes(char))
			const tokenHit =
				tokens.length === 0 ||
				tokens.every(
					(token) =>
						haystack.includes(token) ||
						compactHaystack.includes(token) ||
						pinyinFull.includes(token) ||
						pinyinInitials.includes(token)
				)
			return fuzzyHit && tokenHit
		},
		isCategorySelected(cat) {
			return this.selectedCategories.includes(cat)
		},
		toggleCategory(cat) {
			if (cat === '全部类别') {
				this.selectedCategories = ['全部类别']
				return
			}
			const next = this.selectedCategories.filter((x) => x !== '全部类别')
			if (next.includes(cat)) {
				this.selectedCategories = next.filter((x) => x !== cat)
				if (!this.selectedCategories.length) this.selectedCategories = ['全部类别']
				return
			}
			this.selectedCategories = [...next, cat]
		},
		ensureIconfontSymbol() {
			if (typeof window === 'undefined' || typeof document === 'undefined') return
			const markReady = () => {
				this.emptySymbolReady = !!document.getElementById('icon-bingxiang')
			}
			markReady()
			if (this.emptySymbolReady) return
			if (window.__ffaIconfontLoading) {
				setTimeout(markReady, 160)
				return
			}
			window.__ffaIconfontLoading = true
			const script = document.createElement('script')
			script.src = `/static/iconfont/iconfont.js?v=${ICONFONT_VERSION}`
			script.async = true
			script.onload = () => {
				window.__ffaIconfontLoading = false
				markReady()
			}
			script.onerror = () => {
				window.__ffaIconfontLoading = false
				markReady()
			}
			document.body.appendChild(script)
		},
		bindWindowEvents() {
			if (typeof window === 'undefined') return
			window.addEventListener('mousemove', this.onWindowMouseMove)
			window.addEventListener('mouseup', this.onWindowMouseUp)
		},
		unbindWindowEvents() {
			if (typeof window === 'undefined') return
			window.removeEventListener('mousemove', this.onWindowMouseMove)
			window.removeEventListener('mouseup', this.onWindowMouseUp)
		},
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
				海鲜: '🦐',
				饮料: '🥛',
				调味品: '🧂',
				其他: '🍽️'
			}
			return map[category] || '🍽️'
		},
		formatQty(item) {
			const q = item && item.quantity !== undefined ? `${item.quantity}` : ''
			const u = item && item.unit ? `${item.unit}` : ''
			return `${q}${u}` || '—'
		},
		onKeywordInput(e) {
			this.keyword = e && e.detail ? `${e.detail.value || ''}` : ''
		},
		toggleSortMode() {
			this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc'
		},
		toggleFridgeView() {
			this.viewMode = this.viewMode === 'list' ? 'tiles' : 'list'
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
		barStyle(expireDate) {
			const days = this.getDays(expireDate)
			if (days <= 0) return { width: '92%', background: '#e36b6b' }
			if (days <= 2) return { width: '78%', background: '#f0b24b' }
			if (days <= 5) return { width: '56%', background: '#e0c45a' }
			return { width: '36%', background: '#68bf7a' }
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

		openConsumeDialog(item) {
			this.pendingConsumeItem = item
			this.consumeQty = 1
			this.openSwipeId = ''
			this.consumeDialogVisible = true
		},
		closeConsumeDialog() {
			this.consumeDialogVisible = false
			this.pendingConsumeItem = null
			this.consumeQty = 1
		},
		changeConsumeQty(delta) {
			const max = this.getMaxConsumeQty()
			const current = Number(this.consumeQty || 1)
			const next = current + delta
			if (next < 1) {
				this.consumeQty = 1
				return
			}
			if (delta > 0 && current >= max) {
				const now = Date.now()
				if (now - this.lastQtyLimitToastAt > 1000) {
					this.lastQtyLimitToastAt = now
					uni.showToast({
						title: `当前最多可取 ${max}${this.pendingConsumeItem?.unit || ''}`,
						icon: 'none'
					})
				}
				return
			}
			this.consumeQty = next > max ? max : next
		},
		getMaxConsumeQty() {
			const raw = this.pendingConsumeItem ? Number(this.pendingConsumeItem.quantity) : 1
			if (!raw || raw < 1) return 1
			return Math.floor(raw)
		},
		formatConsumeName(name) {
			const text = `${name || ''}`.trim()
			if (!text) return ''
			const chunkSize = 5
			const parts = []
			for (let i = 0; i < text.length; i += chunkSize) {
				parts.push(text.slice(i, i + chunkSize))
			}
			return parts.join('\n')
		},
		normalizeConsumeQty() {
			const max = this.getMaxConsumeQty()
			const value = Number(this.consumeQty)
			if (!value || value < 1) {
				this.consumeQty = 1
				return
			}
			this.consumeQty = value > max ? max : Math.floor(value)
		},
		onConsumeQtyInput(e) {
			const raw = e && e.detail ? `${e.detail.value || ''}` : `${this.consumeQty || ''}`
			const digits = raw.replace(/[^\d]/g, '')
			if (!digits) {
				this.consumeQty = ''
				return
			}
			this.consumeQty = `${Math.max(1, parseInt(digits, 10))}`
		},
		async confirmConsume() {
			const item = this.pendingConsumeItem
			const quantity = Number(this.consumeQty || 0)
			const max = this.getMaxConsumeQty()
			if (!item) return
			if (!quantity || quantity <= 0) {
				uni.showToast({
					title: '请输入正确数量',
					icon: 'none'
				})
				return
			}
			if (quantity > max) {
				this.consumeQty = max
				uni.showToast({
					title: `库存不足，当前最多可取 ${max}${item.unit || ''}`,
					icon: 'none'
				})
				return
			}
			try {
				await consumeIngredient(item.id, {
					quantity
				})
		
				this.openSwipeId = ''
				this.closeConsumeDialog()
		
				uni.showToast({
					title: `已取出 ${quantity}${item.unit || ''}`,
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

.tiles-wrap {
	margin-bottom: 14rpx;
}

.search-wrap {
	display: flex;
	align-items: center;
	gap: 8rpx;
	flex: 1;
	min-width: 0;
	border: 1rpx solid #e2e8f2;
	border-radius: 999rpx;
	background: #f2f6fb;
	padding: 0 10px;
	box-sizing: border-box;
	margin-bottom: 0;
	height: 32px;
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

.category-chips {
	flex-wrap: nowrap;
	overflow-x: auto;
	overflow-y: visible;
	-webkit-overflow-scrolling: touch;
	padding-top: 10rpx;
	padding-bottom: 2rpx;
}

.category-chips::-webkit-scrollbar {
	display: none;
}

.location-chips {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 6rpx;
	margin-bottom: 0;
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

.category-chip {
	position: relative;
	overflow: visible;
	min-width: 112rpx;
	white-space: nowrap;
}

.all-category-chip {
	min-width: 138rpx;
}

.category-chip text {
	white-space: nowrap;
}

.chip-count {
	position: absolute;
	top: 0;
	right: -6rpx;
	transform: translateY(-50%);
	min-width: 24rpx;
	height: 24rpx;
	padding: 0 5rpx;
	border-radius: 999rpx;
	background: #ffe7a3;
	color: #8a6b18;
	font-size: 9px;
	font-weight: 700;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	border: 2rpx solid #fff6d8;
	z-index: 2;
}

.location-chips .chip {
	width: 100%;
	padding: 10rpx 0;
	border: 1rpx solid transparent;
	font-size: 13px;
	font-weight: 600;
}

.loc-chip {
	display: inline-flex;
	align-items: center;
	gap: 4rpx;
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
	margin: 0;
	flex: 1;
	min-width: 0;
}

.summary-row {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin: 2rpx 2rpx 12rpx;
}

.sort-icon-btn {
	flex-shrink: 0;
	margin-left: auto;
	background: #f2f6fb;
	border: 1rpx solid #e2e8f2;
	border-radius: 999rpx;
	width: 58rpx;
	height: 58rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 4rpx;
}

.tri {
	width: 0;
	height: 0;
	border-left: 7rpx solid transparent;
	border-right: 7rpx solid transparent;
}

.tri.up {
	border-bottom: 10rpx solid #9da9ba;
}

.tri.down {
	border-top: 10rpx solid #9da9ba;
}

.tri.on.up {
	border-bottom-color: #4f8fe8;
}

.tri.on.down {
	border-top-color: #4f8fe8;
}

.name {
	font-size: 16px;
	font-weight: 700;
	color: #1f2329;
}

.meta {
	display: inline-flex;
	align-items: center;
	gap: 4rpx;
	flex-wrap: nowrap;
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

.empty-icon-svg {
	width: 96rpx;
	height: 96rpx;
	display: block;
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
	grid-template-columns: 90rpx 1fr auto;
	gap: 20rpx;
	align-items: center;
	border: 1rpx solid #eceff2;
	border-radius: 16px;
	padding: 12px 10px;
	background: #ffffff;
}

.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 18rpx 24rpx;
}

.tile {
	border: 1rpx solid #e8edf1;
	border-radius: 16px;
	padding: 9px 10px;
	background: #fff;
	box-shadow: 0 6rpx 14rpx rgba(26, 43, 70, 0.06);
	min-height: 116rpx;
	position: relative;
}

.tile-inner {
	display: flex;
	align-items: center;
	gap: 14rpx;
	min-height: 58px;
}

.tile-ico {
	width: 56px;
	height: 56px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f8fbff;
	flex-shrink: 0;
}

.tile-right {
	flex: 1;
	min-width: 0;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
	min-height: 58px;
	gap: 4rpx;
	padding-top: 8px;
	padding-right: 2rpx;
}

.tile-head {
	display: flex;
	align-items: center;
	min-height: 26rpx;
}

.tile-name {
	font-size: 15px;
	font-weight: 700;
	color: #1f2329;
	line-height: 1.25;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	flex: 1;
	min-width: 0;
}

.tile-meta {
	font-size: 12px;
	color: #7a8490;
	line-height: 1.2;
}

.qty-badge {
	position: absolute;
	top: 4px;
	right: 4px;
	padding: 3rpx 10rpx;
	border-radius: 999rpx;
	background: linear-gradient(135deg, #80bdf7, #69a9f1);
	color: #fff;
	font-size: 11px;
	font-weight: 700;
	line-height: 1.2;
	z-index: 2;
}

.fresh-row {
	display: inline-flex;
	align-items: center;
	gap: 5rpx;
}

.bar-track {
	width: 100%;
	height: 6rpx;
	border-radius: 999rpx;
	background: #e9edf1;
	overflow: hidden;
	margin-top: 2rpx;
}

.bar-fill {
	height: 100%;
	border-radius: 999rpx;
}

.tile .tag {
	align-self: flex-end;
}

.ico {
	width: 48px;
	height: 48px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f8fbff;
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

.status {
	user-select: none;
}

.consume-mask {
	position: fixed;
	left: 0;
	right: 0;
	top: 0;
	bottom: 0;
	background: rgba(18, 28, 20, 0.45);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 16px;
	z-index: 99;
}

.consume-card {
	width: 100%;
	max-width: 710rpx;
	background: #fff;
	border-radius: 20px;
	padding: 16px 14px;
	box-shadow: 0 16rpx 32rpx rgba(15, 28, 20, 0.22);
}

.consume-title {
	display: block;
	color: #6f9fea;
	font-size: 20px;
	font-weight: 700;
	margin-bottom: 12px;
}

.consume-line {
	display: flex;
	align-items: flex-start;
	justify-content: space-between;
	gap: 8px;
	margin-bottom: 14px;
}

.consume-name {
	flex: 1;
	min-width: 108px;
	max-width: 132px;
	font-size: 18px;
	font-weight: 700;
	color: #1f2329;
	line-height: 1.35;
	white-space: pre-line;
	word-break: keep-all;
	padding-top: 8px;
	padding-right: 4px;
}

.qty-wrap {
	display: flex;
	align-items: center;
	gap: 6px;
	flex-shrink: 1;
	min-width: 0;
}

.qty-btn {
	width: 34px;
	height: 40px;
	line-height: 40px;
	border: none;
	border-radius: 12px;
	background: #f7faff;
	color: #202b38;
	font-size: 20px;
	font-weight: 700;
	padding: 0;
}

.qty-input {
	width: 64px;
	height: 40px;
	border: 1rpx solid #dfe6f3;
	border-radius: 12px;
	background: #fff;
	text-align: center;
	font-size: 20px;
	color: #202b38;
}

.qty-unit {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-width: 40px;
	height: 40px;
	border-radius: 12px;
	background: linear-gradient(135deg, #83b4ff, #5f95f2);
	color: #fff;
	font-size: 16px;
	font-weight: 700;
	padding: 0 8px;
}

.consume-actions {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12px;
}

.confirm-btn,
.cancel-btn {
	height: 46px;
	width: 100%;
	border: none;
	border-radius: 999rpx;
	color: #fff;
	font-size: 18px;
	font-weight: 700;
}

.confirm-btn {
	background: linear-gradient(135deg, #83b4ff, #5f95f2);
}

.cancel-btn {
	background: #f3f6fb;
	color: #5f6b7a;
	border: 1rpx solid #dce4ef;
}

.qty-btn::after,
.confirm-btn::after,
.cancel-btn::after {
	border: none;
}
</style>
