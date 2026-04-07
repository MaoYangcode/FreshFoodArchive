<template>
	<view class="container">
		<view class="top">
			<text class="top-title">菜篮子</text>
			<view class="capsule" @click="goBack">
				<svg class="back-ico-svg" aria-hidden="true">
					<use href="#icon-fanhui"></use>
				</svg>
			</view>
		</view>

		<view class="stats-row">
			<view class="stat-card todo">
				<text class="stat-label">待购买</text>
				<text class="stat-value">{{ stats.todo }}项</text>
			</view>
			<view class="stat-card done">
				<text class="stat-label">已购买</text>
				<text class="stat-value">{{ stats.done }}项</text>
			</view>
		</view>

		<view class="filter-card">
			<view class="chip-row">
				<view class="chip" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">全部</view>
				<view class="chip" :class="{ active: statusFilter === 'todo' }" @click="statusFilter = 'todo'">待购买</view>
				<view class="chip" :class="{ active: statusFilter === 'done' }" @click="statusFilter = 'done'">已购买</view>
			</view>
			<view class="search-wrap">
				<svg class="search-ico-svg" aria-hidden="true">
					<use href="#icon-sousuo"></use>
				</svg>
				<input
					class="search-input"
					type="text"
					:value="keyword"
					@input="onKeywordInput"
					placeholder="输入关键字搜索食材"
					confirm-type="search"
				/>
			</view>
		</view>

		<view class="action-row">
			<button class="action-btn add" @click="openAddDialog">+ 新增条目</button>
			<button class="action-btn clear" :disabled="stats.done === 0" @click="clearDone">清空已购买</button>
		</view>

		<view v-if="filteredItems.length === 0" class="empty-card">
			<text class="empty-title">{{ items.length === 0 ? '还没有菜篮子条目' : '当前条件下暂无条目' }}</text>
			<text class="empty-sub">{{ items.length === 0 ? '可从菜谱详情把缺少食材加入进来。' : '试试切换筛选或清空搜索关键词。' }}</text>
		</view>

		<view v-for="item in filteredItems" :key="item.id" class="basket-row">
			<view class="check" :class="{ on: item.status === 'done' }" @click="toggleStatus(item)">
				<text v-if="item.status === 'done'">✓</text>
			</view>
			<view class="ico">
				<IngredientIcon :name="item.name" :category="item.category" :size="36" />
			</view>
			<view class="body">
				<text class="name" :class="{ done: item.status === 'done' }">{{ item.name }}</text>
				<text class="meta">{{ item.quantity }}{{ item.unit }} · {{ item.category }}</text>
				<text v-if="item.sourceRecipeName" class="source">来自：{{ item.sourceRecipeName }}</text>
			</view>
			<view class="right">
				<text class="status" :class="item.status === 'done' ? 'done' : 'todo'">{{ item.status === 'done' ? '已购买' : '待购买' }}</text>
				<text class="remove" @click="removeOne(item)">删除</text>
			</view>
		</view>

		<view v-if="dialogVisible" class="mask" @click="closeDialog">
			<view class="dialog" @click.stop>
					<text class="dialog-title">新增条目</text>
					<text class="dialog-sub">补充你要购买的食材信息</text>
				<view class="dialog-row">
					<text class="dialog-label">食材名</text>
					<input v-model="form.name" class="dialog-input" placeholder="请输入食材名" />
				</view>
				<view class="dialog-row">
					<text class="dialog-label">数量</text>
					<input v-model="form.quantity" class="dialog-input short" type="number" placeholder="1" />
					<picker :range="units" @change="onUnitChange">
						<view class="dialog-chip">{{ form.unit || '份' }}</view>
					</picker>
				</view>
				<view class="dialog-row">
					<text class="dialog-label">类别</text>
					<picker :range="categories" @change="onCategoryChange" class="picker-full">
						<view class="dialog-chip full">{{ form.category || '请选择类别' }}</view>
					</picker>
				</view>
				<view class="dialog-actions">
					<button class="btn cancel" @click="closeDialog">取消</button>
					<button class="btn save" @click="submitDialog">保存</button>
				</view>
			</view>
		</view>

		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import { addBasketItem, clearDoneBasketItems, getBasketItems, removeBasketItem, toggleBasketItemStatus } from '@/store/app-store'

export default {
	components: { BottomNav, IngredientIcon },
	data() {
		return {
			items: [],
			statusFilter: 'all',
			keyword: '',
			dialogVisible: false,
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			units: [
				'份', '盒', '罐', '包', '个', '条', '片', '根', '瓶', '袋', '块',
				'毫升', '升', '千克', '克', '斤', '公斤', '颗', '组', '把', '只', '杯',
				'支', '粒', '碗', '枚', '盘', '卷', '段', '篮', '捆', '串', '排',
				'桶', '箱', '颗', '朵', '管', '两'
			],
			form: {
				name: '',
				quantity: '1',
				unit: '份',
				category: ''
			}
		}
	},
	computed: {
		stats() {
			const todo = this.items.filter((x) => x.status !== 'done').length
			const done = this.items.filter((x) => x.status === 'done').length
			return { todo, done }
		},
		filteredItems() {
			const key = `${this.keyword || ''}`.trim().toLowerCase()
			return this.items.filter((item) => {
				if (this.statusFilter === 'todo' && item.status === 'done') return false
				if (this.statusFilter === 'done' && item.status !== 'done') return false
				if (key) {
					const text = `${item.name || ''} ${item.category || ''} ${item.sourceRecipeName || ''}`.toLowerCase()
					if (!text.includes(key)) return false
				}
				return true
			})
		}
	},
	onShow() {
		this.refresh()
	},
	methods: {
		refresh() {
			this.items = getBasketItems()
		},
		goBack() {
			uni.navigateBack()
		},
		onKeywordInput(e) {
			this.keyword = e && e.detail ? `${e.detail.value || ''}` : ''
		},
		toggleStatus(item) {
			toggleBasketItemStatus(item.id)
			this.refresh()
		},
		removeOne(item) {
			removeBasketItem(item.id)
			this.refresh()
			uni.showToast({ title: '已删除', icon: 'none' })
		},
		clearDone() {
			clearDoneBasketItems()
			this.refresh()
			uni.showToast({ title: '已清空已购买', icon: 'none' })
		},
		openAddDialog() {
			this.dialogVisible = true
		},
		closeDialog() {
			this.dialogVisible = false
			this.form = { name: '', quantity: '1', unit: '份', category: '' }
		},
		onUnitChange(e) {
			this.form.unit = this.units[e.detail.value]
		},
		onCategoryChange(e) {
			this.form.category = this.categories[e.detail.value]
		},
		submitDialog() {
			if (!`${this.form.name || ''}`.trim()) {
				uni.showToast({ title: '请输入食材名', icon: 'none' })
				return
			}
			addBasketItem({
				name: this.form.name,
				quantity: Number(this.form.quantity || 1),
				unit: this.form.unit || '份',
				category: this.form.category || '其他'
			})
			this.closeDialog()
			this.refresh()
			uni.showToast({ title: '已加入菜篮子', icon: 'success' })
		}
	}
}
</script>

<style scoped>
@font-face {
	font-family: "basket-iconfont";
	src: url('/static/iconfont/iconfont.ttf') format('truetype');
}

.container { padding: 10px 12px 88px; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.capsule { border: 1rpx solid #e2e9e4; border-radius: 999rpx; background: #fff; min-width: 88rpx; height: 56rpx; padding: 0 16rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.back-ico-svg { width: 20px; height: 20px; display: block; }

.stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 10rpx; }
.stat-card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 14px; padding: 10px; }
.stat-label { display: block; font-size: 12px; color: #738177; }
.stat-value { display: block; margin-top: 4rpx; font-size: 18px; font-weight: 700; color: #1f2a22; }
.stat-card.todo { border-color: #dbeede; background: #f8fdf9; }
.stat-card.done { border-color: #e7ecea; background: #fbfcfb; }

.filter-card { background: #fff; border: 1rpx solid #e8edf0; border-radius: 14px; padding: 10px; margin-bottom: 10rpx; }
.chip-row { display: flex; gap: 8rpx; margin-bottom: 8rpx; }
.chip { background: #f3f6f8; color: #6b7583; border: 1rpx solid #e6ebef; border-radius: 999rpx; padding: 4rpx 12rpx; font-size: 11px; }
.chip.active { background: #e8f0ff; color: #4a73d9; border-color: #d9e5ff; }

.search-wrap { display: flex; align-items: center; gap: 8rpx; border: 1rpx solid #e2e8ef; border-radius: 999rpx; background: #f3f7fb; padding: 0 10px; box-sizing: border-box; height: 32px; }
.search-ico-svg { width: 18px; height: 18px; display: block; flex-shrink: 0; shape-rendering: geometricPrecision; transform: translateZ(0); }
.search-input { flex: 1; height: 32px; line-height: 32px; font-size: 12px; color: #5d6d82; }

.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 10rpx; }
.action-btn { border-radius: 999rpx; font-size: 12px; font-weight: 700; }
.action-btn.add { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; }
.action-btn.clear { background: #edf2ef; color: #617268; }
.action-btn::after { border: none; }

.empty-card { border: 1rpx dashed #dbe5df; border-radius: 14px; background: #fbfdfc; padding: 16px 12px; text-align: center; margin-bottom: 10rpx; }
.empty-title { display: block; font-size: 14px; font-weight: 700; color: #2a352f; }
.empty-sub { display: block; margin-top: 6rpx; font-size: 12px; color: #7a8680; }

.basket-row { display: grid; grid-template-columns: 28rpx 56px 1fr auto; gap: 10rpx; align-items: center; border: 1rpx solid #edf2ef; border-radius: 14px; padding: 9px; background: #fff; margin-bottom: 10rpx; }
.check { width: 24rpx; height: 24rpx; border-radius: 50%; border: 2rpx solid #cfd8d2; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 11px; }
.check.on { border-color: #67b374; background: #67b374; }
.ico { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; background: #f4f9f5; border: 1rpx solid #e7efea; }
.body { min-width: 0; }
.name { display: block; font-size: 14px; font-weight: 700; color: #1f2a22; }
.name.done { color: #8e9a93; text-decoration: line-through; }
.meta { display: block; font-size: 12px; color: #738177; margin-top: 4rpx; }
.source { display: block; margin-top: 4rpx; font-size: 10px; color: #8fa398; }
.right { display: flex; flex-direction: column; align-items: flex-end; gap: 8rpx; }
.status { font-size: 10px; border-radius: 999rpx; padding: 4rpx 8rpx; }
.status.todo { background: #fff0db; color: #c97e1e; }
.status.done { background: #e9f8ec; color: #3f9f4d; }
.remove { font-size: 11px; color: #a0a9b3; }

.mask { position: fixed; inset: 0; background: rgba(14, 24, 17, 0.42); display: flex; align-items: center; justify-content: center; padding: 12px; z-index: 99; }
.dialog { width: 100%; max-width: 700rpx; background: #fff; border-radius: 18px; padding: 14px 12px 12px; box-shadow: 0 14rpx 30rpx rgba(17, 34, 22, 0.22); }
.dialog-title { display: block; font-size: 18px; font-weight: 700; color: #1f2a22; }
.dialog-sub { display: block; margin-top: 4rpx; margin-bottom: 12rpx; font-size: 11px; color: #829087; }
.dialog-row { display: flex; align-items: center; gap: 8rpx; margin-bottom: 10rpx; background: #f4f8f5; border: 1rpx solid #e3ece6; border-radius: 12px; padding: 9px 10px; }
.dialog-label { width: 56px; font-size: 13px; font-weight: 600; color: #33443a; }
.dialog-input { flex: 1; height: 36px; border: 1rpx solid #d9e5de; border-radius: 10px; background: #fff; padding: 0 10rpx; font-size: 13px; color: #2f3f36; }
.dialog-input.short { max-width: 180rpx; }
.picker-full { flex: 1; }
.dialog-chip { min-width: 96rpx; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #70c977, #4cae57); border: none; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; padding: 0 10rpx; font-weight: 700; }
.dialog-chip.full { width: 100%; }
.dialog-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 8rpx; }
.btn { border-radius: 999rpx; font-size: 13px; font-weight: 700; height: 40px; line-height: 40px; }
.btn.cancel { background: #e8efea; color: #5f7266; }
.btn.save { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.24); }
.btn::after { border: none; }
</style>
