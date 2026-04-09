<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back-left" @click="goBack">
				<text class="back-arrow">‹</text>
			</view>
			<text class="top-title">菜篮子</text>
		</view>

		<view class="stats-row">
			<view class="stat-card todo single">
				<text class="stat-label">待购买</text>
				<text class="stat-value">{{ stats.todo }}项</text>
			</view>
		</view>

		<view class="filter-card">
			<view class="chip-row">
				<view class="chip" :class="{ active: statusFilter === 'all' }" @click="statusFilter = 'all'">全部</view>
				<view class="chip" :class="{ active: statusFilter === 'todo' }" @click="statusFilter = 'todo'">待购买</view>
				<view class="chip" :class="{ active: statusFilter === 'done' }" @click="statusFilter = 'done'">已购买</view>
			</view>
			<view class="search-wrap">
				<text class="search-ico-text">⌕</text>
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
			<button class="action-btn add" @click="openAddDialog">+ 新增购买项</button>
			<button class="action-btn restock" :disabled="stats.done === 0" @click="openRestockDialog">一键补货入库</button>
		</view>

		<view v-if="filteredItems.length === 0" class="empty-card">
			<text class="empty-title">{{ items.length === 0 ? '还没有菜篮子购买项' : '当前条件下暂无购买项' }}</text>
			<text class="empty-sub">{{ items.length === 0 ? '可从菜谱详情把缺少食材加入进来。' : '试试切换筛选或清空搜索关键词。' }}</text>
		</view>

		<view v-for="item in filteredItems" :key="item.id" class="basket-row">
			<view class="check-hit" @tap.stop="toggleStatus(item)" @click.stop="toggleStatus(item)">
				<view class="check" :class="{ on: item.status === 'done', busy: isStatusUpdating(item.id) }">
				<text v-if="item.status === 'done'">✓</text>
				</view>
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
				<text class="status" :class="item.status === 'done' ? 'done' : 'todo'" @tap.stop="toggleStatus(item)" @click.stop="toggleStatus(item)">{{ item.status === 'done' ? '已购买' : '待购买' }}</text>
				<text class="remove" @tap.stop="removeOne(item)">删除</text>
			</view>
		</view>

		<view v-if="dialogVisible" class="mask" @click="closeDialog">
			<view class="dialog" @click.stop>
					<text class="dialog-title">新增购买项</text>
					<text class="dialog-sub">补充你要购买的食材信息</text>
				<view class="dialog-row">
					<text class="dialog-prefix">◍</text>
					<text class="dialog-label">食材名</text>
					<input v-model="form.name" class="dialog-input" placeholder="请输入食材名" />
				</view>
				<view class="dialog-row">
					<text class="dialog-prefix">◫</text>
					<text class="dialog-label">数量</text>
					<input v-model="form.quantity" class="dialog-input short qty-input-light" type="number" placeholder="1" />
					<picker :range="units" @change="onUnitChange">
						<view class="dialog-chip">{{ form.unit || '份' }}</view>
					</picker>
				</view>
				<view class="dialog-row">
					<text class="dialog-prefix">☰</text>
					<text class="dialog-label">类别</text>
					<picker :range="categories" @change="onCategoryChange" class="picker-full">
						<view class="dialog-chip full">{{ form.category || '请选择类别' }}</view>
					</picker>
				</view>
				<view class="dialog-actions restock-actions">
					<button class="btn cancel" @click="closeDialog">取消</button>
					<button class="btn save" @click="submitDialog">保存</button>
				</view>
			</view>
		</view>

		<view v-if="restockDialogVisible" class="mask" @click="closeRestockDialog">
			<view class="dialog restock-dialog" @click.stop>
				<text class="dialog-title">一键补货入库</text>
				<view class="restock-list">
					<view v-for="(entry, idx) in restockEntries" :key="entry.id" class="restock-item">
						<view class="restock-line1">
							<view class="restock-item-main">
								<view class="restock-item-ico">
									<IngredientIcon :name="entry.name" :category="entry.category" :size="30" />
								</view>
								<view class="restock-item-text">
									<text class="restock-item-name">{{ entry.name }}</text>
								</view>
							</view>
							<view class="restock-item-edit">
								<view class="restock-stepper">
									<view class="restock-step-btn" @click="decreaseRestockQty(idx)">
										<view class="restock-step-sign restock-minus-sign"></view>
									</view>
									<text class="restock-step-val">{{ entry.quantity }}</text>
									<view class="restock-step-btn" @click="increaseRestockQty(idx)">
										<view class="restock-step-sign restock-plus-sign"></view>
									</view>
								</view>
								<picker :range="units" @change="onRestockUnitChange(idx, $event)">
									<text class="restock-unit-chip">{{ entry.unit || '份' }}</text>
								</picker>
							</view>
						</view>
						<view class="restock-line2">
							<picker :range="restockLocationOptions" @change="onRestockLocationChange(idx, $event)">
								<view class="restock-meta">
									<LocationIcon :location="entry.location" :size="14" color="#6f9fea" />
									<text class="restock-meta-text">{{ entry.location || '冷藏' }}</text>
								</view>
							</picker>
							<picker :range="categories" @change="onRestockCategoryChange(idx, $event)">
								<view class="restock-meta">
									<text class="restock-meta-dot">·</text>
									<text class="restock-meta-text">{{ entry.category || '其他' }}</text>
								</view>
							</picker>
							<picker mode="date" :value="entry.expireDate" @change="onRestockDateChange(idx, $event)">
								<view class="restock-meta">
									<text class="restock-date-ico">&#xe621;</text>
									<text class="restock-meta-text">{{ entry.expireDate || getTodayDateText() }}</text>
								</view>
							</picker>
						</view>
					</view>
				</view>
				<view class="dialog-actions restock-actions">
					<button class="btn cancel" @click="closeRestockDialog">取消</button>
					<button class="btn save" @click="submitRestock">确认入库</button>
				</view>
			</view>
		</view>

		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import LocationIcon from '@/components/location-icon.vue'
import { getShelfLifeSettings } from '@/api/modules/shelf-life'
import { getCurrentUserId } from '@/utils/current-user'
import { DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY, normalizeShelfLifeDaysByCategory } from '@/utils/shelf-life'
import {
	addBasketItem,
	clearDoneBasketItems,
	getBasketItems,
	restockDoneBasketItems,
	removeBasketItem,
	toggleBasketItemStatus
} from '@/api/modules/basket'

export default {
	components: { BottomNav, IngredientIcon, LocationIcon },
	data() {
		return {
			userId: getCurrentUserId(),
			items: [],
			statusFilter: 'all',
			keyword: '',
			dialogVisible: false,
			restockDialogVisible: false,
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			restockLocationOptions: ['冷藏', '冷冻'],
			restockEntries: [],
			restockShelfLifeDaysByCategory: { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY },
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
			},
			statusUpdatingMap: {},
			statusSyncedMap: {},
			statusDesiredMap: {}
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
		},
		doneItems() {
			return this.items.filter((x) => x.status === 'done')
		}
	},
	async onShow() {
		this.userId = getCurrentUserId()
		await this.loadShelfLifeSettings()
		this.refresh()
	},
	methods: {
		async loadShelfLifeSettings() {
			try {
				const res = await getShelfLifeSettings(this.userId)
				const rules = res?.rules || res?.data?.rules || {}
				this.restockShelfLifeDaysByCategory = normalizeShelfLifeDaysByCategory(rules)
			} catch (e) {
				this.restockShelfLifeDaysByCategory = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
			}
		},
		async refresh() {
			try {
				const res = await getBasketItems(this.userId)
				this.items = Array.isArray(res) ? res : []
				const synced = {}
				this.items.forEach((item) => {
					if (!item || !item.id) return
					synced[item.id] = item.status === 'done' ? 'done' : 'todo'
				})
				this.statusSyncedMap = synced
				this.statusDesiredMap = { ...synced }
			} catch (e) {
				this.items = []
				uni.showToast({ title: '菜篮子加载失败', icon: 'none' })
			}
		},
		goBack() {
			uni.navigateBack()
		},
		onKeywordInput(e) {
			this.keyword = e && e.detail ? `${e.detail.value || ''}` : ''
		},
		isStatusUpdating(id) {
			return Boolean(this.statusUpdatingMap && this.statusUpdatingMap[id])
		},
		getItemById(id) {
			return this.items.find((entry) => entry.id === id) || null
		},
		setItemStatus(id, status) {
			this.items = this.items.map((entry) => (
				entry.id === id ? { ...entry, status } : entry
			))
		},
		async flushStatusSync(id) {
			if (!id || this.isStatusUpdating(id)) return
			const desired = this.statusDesiredMap[id]
			const synced = this.statusSyncedMap[id]
			if (!desired || !synced || desired === synced) return
			this.$set(this.statusUpdatingMap, id, true)
			try {
				await toggleBasketItemStatus(id, this.userId)
				const nextSynced = synced === 'done' ? 'todo' : 'done'
				this.$set(this.statusSyncedMap, id, nextSynced)
			} catch (e) {
				this.setItemStatus(id, synced)
				this.$set(this.statusDesiredMap, id, synced)
				uni.showToast({ title: '更新失败', icon: 'none' })
			} finally {
				this.$delete(this.statusUpdatingMap, id)
			}
			const finalDesired = this.statusDesiredMap[id]
			const finalSynced = this.statusSyncedMap[id]
			if (finalDesired && finalSynced && finalDesired !== finalSynced) {
				this.flushStatusSync(id)
			}
		},
		async toggleStatus(item) {
			if (!item || !item.id) return
			const id = item.id
			const current = this.getItemById(id)
			if (!current) return
			const nextStatus = current.status === 'done' ? 'todo' : 'done'
			this.setItemStatus(id, nextStatus)
			this.$set(this.statusDesiredMap, id, nextStatus)
			this.flushStatusSync(id)
		},
		async removeOne(item) {
			try {
				await removeBasketItem(item.id, this.userId)
				this.refresh()
				uni.showToast({ title: '已删除', icon: 'none' })
			} catch (e) {
				uni.showToast({ title: '删除失败', icon: 'none' })
			}
		},
		async clearDone() {
			try {
				await clearDoneBasketItems(this.userId)
				this.refresh()
				uni.showToast({ title: '已清空已购买', icon: 'none' })
			} catch (e) {
				uni.showToast({ title: '清空失败', icon: 'none' })
			}
		},
		getTodayDateText() {
			const date = new Date()
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			return `${y}-${m}-${d}`
		},
		getExpireDateByCategory(category, baseDateText = '') {
			const days = Number(this.restockShelfLifeDaysByCategory?.[category] || this.restockShelfLifeDaysByCategory?.['其他'] || 7)
			const safeDays = Number.isFinite(days) && days > 0 ? Math.round(days) : 7
			const base = baseDateText ? new Date(baseDateText) : new Date()
			const date = Number.isNaN(base.getTime()) ? new Date() : base
			date.setHours(0, 0, 0, 0)
			date.setDate(date.getDate() + safeDays)
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			return `${y}-${m}-${d}`
		},
		openRestockDialog() {
			if (!this.doneItems.length) {
				uni.showToast({ title: '暂无已购购买项', icon: 'none' })
				return
			}
			const today = this.getTodayDateText()
			this.restockEntries = this.doneItems.map((item) => ({
				id: item.id,
				name: item.name,
				category: item.category || '其他',
				quantity: Number(item.quantity || 1),
				unit: item.unit || '份',
				location: '冷藏',
				restockDate: today,
				expireDate: this.getExpireDateByCategory(item.category || '其他', today)
			}))
			this.restockDialogVisible = true
		},
		closeRestockDialog() {
			this.restockDialogVisible = false
			this.restockEntries = []
		},
		onRestockLocationChange(index, e) {
			const idx = Number(e && e.detail ? e.detail.value : 0)
			if (!this.restockEntries[index]) return
			this.restockEntries[index].location = this.restockLocationOptions[idx] || '冷藏'
		},
		onRestockDateChange(index, e) {
			if (!this.restockEntries[index]) return
			const value = e && e.detail ? `${e.detail.value || ''}` : this.getTodayDateText()
			this.restockEntries[index].expireDate = value || this.getTodayDateText()
		},
		onRestockCategoryChange(index, e) {
			if (!this.restockEntries[index]) return
			const idx = Number(e && e.detail ? e.detail.value : 0)
			const category = this.categories[idx] || '其他'
			this.restockEntries[index].category = category
			this.restockEntries[index].expireDate = this.getExpireDateByCategory(
				category,
				this.restockEntries[index].restockDate || this.getTodayDateText()
			)
		},
		increaseRestockQty(index) {
			if (!this.restockEntries[index]) return
			const current = Number(this.restockEntries[index].quantity || 1)
			this.restockEntries[index].quantity = Number.isFinite(current) && current > 0 ? current + 1 : 2
		},
		decreaseRestockQty(index) {
			if (!this.restockEntries[index]) return
			const current = Number(this.restockEntries[index].quantity || 1)
			const safeCurrent = Number.isFinite(current) && current > 0 ? current : 1
			this.restockEntries[index].quantity = Math.max(1, safeCurrent - 1)
		},
		onRestockUnitChange(index, e) {
			if (!this.restockEntries[index]) return
			const idx = Number(e && e.detail ? e.detail.value : 0)
			this.restockEntries[index].unit = this.units[idx] || '份'
		},
		async submitRestock() {
			try {
				if (!this.restockEntries.length) {
					uni.showToast({ title: '暂无可入库购买项', icon: 'none' })
					return
				}
				const res = await restockDoneBasketItems({
					userId: this.userId,
					restockDate: this.getTodayDateText(),
					location: '冷藏',
					defaultShelfLifeDays: 7,
					shelfLifeDaysByCategory: this.restockShelfLifeDaysByCategory,
					itemSettings: this.restockEntries.map((entry) => ({
						id: entry.id,
						restockDate: entry.restockDate || this.getTodayDateText(),
						expireDate: entry.expireDate || this.getTodayDateText(),
						location: entry.location || '冷藏',
						category: entry.category || '其他',
						quantity: Number(entry.quantity || 1),
						unit: entry.unit || '份'
					}))
				})
				this.closeRestockDialog()
				await this.refresh()
				const created = Number(res && res.created ? res.created : 0)
				uni.showToast({
					title: created > 0 ? `已入库${created}项` : '没有可入库购买项',
					icon: 'none'
				})
			} catch (e) {
				uni.showToast({ title: '补货失败，请重试', icon: 'none' })
			}
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
		async submitDialog() {
			if (!`${this.form.name || ''}`.trim()) {
				uni.showToast({ title: '请输入食材名', icon: 'none' })
				return
			}
			try {
				await addBasketItem({
					userId: this.userId,
					name: this.form.name,
					quantity: Number(this.form.quantity || 1),
					unit: this.form.unit || '份',
					category: this.form.category || '其他'
				})
				this.closeDialog()
				this.refresh()
				uni.showToast({ title: '已加入菜篮子', icon: 'success' })
			} catch (e) {
				uni.showToast({ title: '新增失败', icon: 'none' })
			}
		}
	}
}
</script>

<style scoped>

.container { padding: 10px 12px 88px; }
.top { display: flex; align-items: center; gap: 10rpx; margin-bottom: 10rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.back-left { width: 30px; height: 30px; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; }
.back-arrow { font-size: 30px; line-height: 1; color: #c7ced9; transform: translateY(-1px); }

.stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 10rpx; }
.stat-card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 14px; padding: 10px; }
.stat-card.single { grid-column: 1 / -1; }
.stat-label { display: block; font-size: 12px; color: #738177; }
.stat-value { display: block; margin-top: 4rpx; font-size: 18px; font-weight: 700; color: #1f2a22; }
.stat-card.todo { border-color: #dbeede; background: #f8fdf9; }
.stat-card.done { border-color: #e7ecea; background: #fbfcfb; }

.filter-card { background: #fff; border: 1rpx solid #e8edf0; border-radius: 14px; padding: 10px; margin-bottom: 10rpx; }
.chip-row { display: flex; gap: 8rpx; margin-bottom: 8rpx; }
.chip { background: #f3f6f8; color: #6b7583; border: 1rpx solid #e6ebef; border-radius: 999rpx; padding: 4rpx 12rpx; font-size: 11px; }
.chip.active { background: #e8f0ff; color: #4a73d9; border-color: #d9e5ff; }

.search-wrap { display: flex; align-items: center; gap: 8rpx; border: 1rpx solid #e2e8ef; border-radius: 999rpx; background: #f3f7fb; padding: 0 10px; box-sizing: border-box; height: 32px; }
.search-ico-text { width: 18px; height: 18px; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 16px; line-height: 1; color: #90a1b5; }
.search-input { flex: 1; height: 32px; line-height: 32px; font-size: 12px; color: #5d6d82; }

.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; margin-bottom: 10rpx; }
.action-btn { border-radius: 999rpx; font-size: 12px; font-weight: 700; }
.action-btn.add { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; }
.action-btn.clear { background: #edf2ef; color: #617268; }
.action-btn.restock { background: linear-gradient(135deg, #6fb8ff, #4f8ff0); color: #fff; }
.action-btn::after { border: none; }

.empty-card { border: 1rpx dashed #dbe5df; border-radius: 14px; background: #fbfdfc; padding: 16px 12px; text-align: center; margin-bottom: 10rpx; }
.empty-title { display: block; font-size: 14px; font-weight: 700; color: #2a352f; }
.empty-sub { display: block; margin-top: 6rpx; font-size: 12px; color: #7a8680; }

.basket-row { display: grid; grid-template-columns: 40rpx 56px 1fr auto; gap: 10rpx; align-items: center; border: 1rpx solid #edf2ef; border-radius: 14px; padding: 9px; background: #fff; margin-bottom: 10rpx; }
.check-hit { width: 40rpx; height: 40rpx; display: inline-flex; align-items: center; justify-content: center; }
.check { width: 28rpx; height: 28rpx; border-radius: 50%; border: 2rpx solid #cfd8d2; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 12px; transition: opacity .15s ease; }
.check.on { border-color: #67b374; background: #67b374; }
.check.busy { opacity: .6; }
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
.dialog-prefix { width: 24px; text-align: center; color: #5ea878; font-size: 18px; line-height: 1; flex-shrink: 0; transform: translateY(-1px); }
.dialog-label { width: 56px; font-size: 13px; font-weight: 600; color: #33443a; }
.dialog-input { flex: 1; height: 36px; border: 1rpx solid #d9e5de; border-radius: 10px; background: #fff; padding: 0 10rpx; font-size: 13px; color: #2f3f36; }
.dialog-input.short { max-width: 180rpx; }
.qty-input-light { color: #93a49b; }
.picker-full { flex: 1; }
.dialog-chip { min-width: 96rpx; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #70c977, #4cae57); border: none; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; padding: 0 10rpx; font-weight: 700; }
.dialog-chip.full { width: 100%; }
.dialog-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 8rpx; }
.btn { border-radius: 999rpx; font-size: 13px; font-weight: 700; height: 40px; line-height: 40px; }
.btn.cancel { background: #e8efea; color: #5f7266; }
.btn.save { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.24); }
.btn::after { border: none; }

.restock-dialog { max-height: 82vh; overflow: hidden; display: flex; flex-direction: column; }
.restock-list { margin-top: 4rpx; padding: 6px 2px 2px; overflow: auto; max-height: 56vh; }
.restock-actions { display: flex; justify-content: space-between; gap: 20rpx; }
.restock-actions .btn { flex: 1; max-width: none; height: 44px; line-height: 44px; }
.restock-item { border: 1rpx solid #d9e6fb; border-radius: 12px; background: #f6f9ff; padding: 10px; margin-bottom: 10rpx; }
.restock-line1 { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8rpx; }
.restock-item-main { display: inline-flex; align-items: center; min-width: 0; gap: 14rpx; }
.restock-item-ico { width: 34px; height: 34px; border-radius: 10px; background: #f1f6ff; border: 1rpx solid #d8e6fb; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.restock-item-text { min-width: 0; }
.restock-item-name { font-size: 16px; font-weight: 700; color: #24362b; }
.restock-item-edit { margin-left: auto; display: inline-flex; align-items: center; gap: 8rpx; flex-shrink: 0; }
.restock-stepper { height: 56rpx; display: inline-flex; align-items: center; gap: 10rpx; }
.restock-step-btn { width: 28rpx; height: 28rpx; border-radius: 8rpx; background: #eef5ff; color: #4a73d9; display: inline-flex; align-items: center; justify-content: center; line-height: 1; font-size: 18px; font-weight: 700; position: relative; }
.restock-step-sign { position: relative; width: 16rpx; height: 16rpx; display: block; }
.restock-minus-sign::before,
.restock-plus-sign::before,
.restock-plus-sign::after {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	background: #4a73d9;
	border-radius: 999rpx;
	transform: translate(-50%, -50%);
}
.restock-minus-sign::before,
.restock-plus-sign::before {
	width: 14rpx;
	height: 3rpx;
}
.restock-plus-sign::after {
	width: 3rpx;
	height: 14rpx;
}
.restock-step-val { min-width: 24rpx; height: 28rpx; display: inline-flex; align-items: center; justify-content: center; text-align: center; font-size: 15px; font-weight: 700; color: #21362b; line-height: 28rpx; }
.restock-unit-chip { display: inline-flex; align-items: center; justify-content: center; height: 44rpx; min-width: 64rpx; border-radius: 999rpx; background: #e7f1ff; border: 1rpx solid #bdd4f8; font-size: 13px; color: #4a86df; font-weight: 600; padding: 0 12rpx; }
.restock-line2 { display: flex; align-items: center; justify-content: space-between; gap: 8rpx; }
.restock-meta { display: inline-flex; align-items: center; gap: 4rpx; height: 42rpx; padding: 0 8rpx; border-radius: 8px; background: #f6faf7; border: none; }
.restock-meta-text { line-height: 1; color: #6e8175; font-size: 12px; }
.restock-meta-dot { font-size: 13px; font-weight: 700; color: #6e8175; line-height: 1; }
.restock-date-ico { color: #4f8fe8; display: inline-flex; align-items: center; justify-content: center; font-size: 14px; line-height: 1; font-family: "iconfont" !important; font-style: normal; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
</style>
