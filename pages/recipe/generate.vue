<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top" :style="{ paddingRight: `${navRightGap}px` }">
			<view class="top-title-wrap">
				<view v-if="fromProfile" class="back-left" @click="backToProfile"><text class="back-arrow">‹</text></view>
				<text class="top-title">菜谱</text>
			</view>
		</view>

		<view class="page-tabs">
			<view class="page-tab" :class="{ active: activeTab === 'recommend' }" @click="switchTab('recommend')">菜谱推荐</view>
			<view class="page-tab" :class="{ active: activeTab === 'plan' }" @click="switchTab('plan')">我的计划</view>
		</view>

		<view v-if="activeTab === 'recommend'" class="recommend-page">
			<view class="recipe-screen">
				<view class="recipe-cover-badge"><text class="recipe-cover-icon">&#xe623;</text></view>
				<view class="recipe-paper">
					<view class="menu-heading">
						<text class="menu-kicker">TODAY'S MENU</text>
						<text class="menu-title">今天想吃什么？</text>
						<view class="menu-divider"><view class="menu-divider-line"></view><text class="menu-divider-mark">◆</text><view class="menu-divider-line"></view></view>
						<text class="menu-meta">选择食材和偏好，为你生成专属菜谱</text>
					</view>

					<view class="setting-card ingredient-setting">
						<view class="section-head">
							<view><text class="section-title">食材选择</text></view>
							<text class="modify-ingredients" @click="openIngredientPicker">修改 ›</text>
						</view>
						<view v-if="selectedIngredients.length" class="ingredient-summary" @click="openIngredientPicker">
							<view class="ingredient-preview-list">
								<view v-for="item in selectedPreviewItems" :key="item.name" class="ingredient-preview">
									<IngredientIcon :name="item.name" :category="item.category || ''" :size="32" />
								</view>
								<view v-if="selectedIngredients.length > selectedPreviewItems.length" class="ingredient-preview more">+{{ selectedIngredients.length - selectedPreviewItems.length }}</view>
							</view>
							<view class="ingredient-summary-copy">
								<text class="ingredient-summary-count">已选择 {{ selectedIngredients.length }} 种食材</text>
								<text class="ingredient-summary-names">{{ selectedIngredientNames }}</text>
							</view>
						</view>
						<view v-else class="ingredient-summary empty" @click="openIngredientPicker"><text>＋ 选择食材</text><text>从冰箱已有食材中选择</text></view>
					</view>

					<view class="setting-card compact">
						<view class="section-head taste-section-head">
							<view><text class="section-title">本次口味</text></view>
						</view>
						<view class="chip-list option-list">
							<view v-for="item in tasteOptions" :key="item" class="chip option-chip" :class="{ selected: tastePreference === item, disabled: isTasteDisabled(item) }" @click="selectTaste(item)">{{ item }}</view>
						</view>
					</view>

					<view class="setting-card compact time-setting">
						<text class="section-title">制作时间</text>
						<view class="chip-list option-list">
							<view v-for="item in timeOptions" :key="item.value" class="chip option-chip" :class="{ selected: cookingTime === item.value }" @click="cookingTime = item.value">{{ item.label }}</view>
						</view>
					</view>

					<button class="generate-btn" :loading="isGenerating" :disabled="isGenerating" @click="generate">{{ generateButtonText }}</button>
				</view>
			</view>
		</view>

		<view v-else class="plan-page">
			<view class="plan-date-card">
				<view class="plan-date-head">
					<view>
						<text class="plan-month">{{ selectedMonthText }}</text>
						<text class="plan-date-sub">{{ selectedDateDetail }}</text>
					</view>
					<view class="calendar-btn" @click="openDateCalendar">选择日期</view>
				</view>
				<view class="date-strip">
					<view class="date-strip-inner">
						<view
							v-for="day in dateStrip"
							:key="day.date"
							class="date-item"
							:class="{
								'date-selected': selectedDate === day.date,
								'date-today': day.isToday && selectedDate !== day.date
							}"
							@click.stop="selectDate(day.date)"
						>
							<view v-if="selectedDate === day.date" class="date-selected-fill">
								<text class="date-week selected-date-text">{{ day.week }}</text>
								<text class="date-day selected-date-text">{{ day.day }}</text>
								<view v-if="day.hasPlan" class="plan-dot selected-plan-dot"></view>
							</view>
							<block v-else>
								<text class="date-week">{{ day.week }}</text>
								<text class="date-day">{{ day.day }}</text>
								<view v-if="day.hasPlan" class="plan-dot"></view>
							</block>
						</view>
					</view>
				</view>
			</view>

			<view class="day-summary">
				<text class="day-summary-title">当日安排</text>
			</view>

			<view v-for="meal in mealSections" :key="meal.key" class="meal-card">
				<view class="meal-head">
					<view class="meal-name-wrap">
						<view class="meal-icon"><image :src="meal.icon" mode="aspectFit" /></view>
						<text class="meal-name">{{ meal.label }}</text>
					</view>
					<text v-if="plansForMeal(meal.key).length" class="meal-count">{{ plansForMeal(meal.key).length }} 道</text>
				</view>
				<view v-if="plansForMeal(meal.key).length" class="meal-recipes">
					<view v-for="plan in plansForMeal(meal.key)" :key="plan.id" class="plan-recipe" :class="{ completed: plan.status === 'completed' }" @click="openPlanRecipe(plan)">
						<view class="recipe-mark"><IngredientIcon :name="pickPlanRecipeIconName(plan)" :size="34" /></view>
						<view class="plan-recipe-main">
							<text class="plan-recipe-name">{{ plan.recipeName }}</text>
							<text class="plan-recipe-meta">{{ plan.status === 'completed' ? '已完成' : `${plan.servings}人份${plan.duration ? ` · ${plan.duration}分钟` : ''}` }}</text>
						</view>
						<text class="remove-plan" @click.stop="confirmRemovePlan(plan)">移除</text>
					</view>
				</view>
				<view v-else class="meal-empty" @click="switchTab('recommend')"><text>＋</text> 去推荐菜谱中添加</view>
			</view>
		</view>

		<view v-if="dateCalendarVisible" class="date-calendar-mask" @click="closeDateCalendar">
			<view class="date-calendar-modal" @click.stop>
				<view class="date-calendar-modal-head">
					<text class="date-calendar-modal-title">选择日期</text>
					<text class="date-calendar-modal-close" @click="closeDateCalendar">×</text>
				</view>
				<RecipeDateCalendar v-model="calendarDraftDate" label="计划日期" />
				<button class="date-calendar-confirm" @click="confirmDateCalendar">确定</button>
			</view>
		</view>

		<view v-if="ingredientPickerVisible" class="ingredient-picker-mask" @click="closeIngredientPicker">
			<view class="ingredient-picker" @click.stop>
				<view class="ingredient-picker-head">
					<view><text class="ingredient-picker-title">食材选择</text><text class="ingredient-picker-sub">已选择 {{ selectedIngredients.length }} 种</text></view>
					<text class="ingredient-picker-done" @click="closeIngredientPicker">完成</text>
				</view>
				<scroll-view class="ingredient-picker-body" scroll-y :show-scrollbar="false">
					<view class="picker-tools">
						<text class="picker-section-title">冰箱已有</text>
						<view class="picker-tool-actions"><text @click="selectAllPantry">全选</text><text @click="clearIngredientSelection">清空</text></view>
					</view>
					<view class="ingredient-grid-wrap">
						<view v-if="pantryIngredients.length" class="ingredient-grid">
							<view v-for="item in pantryIngredients" :key="`pantry-${item.name}`" class="ingredient-grid-item" :class="{ selected: isIngredientSelected(item.name) }" @click="toggleIngredient(item.name)">
								<view class="ingredient-grid-icon"><IngredientIcon :name="item.name" :category="item.category || ''" :size="44" /></view>
								<text class="ingredient-grid-name">{{ item.name }}</text>
								<view v-if="isIngredientSelected(item.name)" class="ingredient-check">✓</view>
							</view>
						</view>
						<view v-else class="picker-empty">冰箱中还没有可选择的食材</view>
					</view>
					<view class="picker-custom-area">
						<text class="picker-section-title">手动添加</text>
						<view class="custom-input-row">
							<input v-model="customIngredientInput" class="custom-input" maxlength="12" placeholder="例如：鸡肉、藜麦" confirm-type="done" @confirm="addCustomIngredient" />
							<button class="add-btn" @click="addCustomIngredient">添加</button>
						</view>
						<view v-if="customIngredients.length" class="ingredient-grid custom-ingredient-grid">
							<view v-for="name in customIngredients" :key="`custom-${name}`" class="ingredient-grid-item selected" @click="removeCustomIngredient(name)">
								<view class="ingredient-grid-icon"><IngredientIcon :name="name" category="其他" :size="44" /></view>
								<text class="ingredient-grid-name">{{ name }}</text>
								<view class="ingredient-check">✓</view>
							</view>
						</view>
					</view>
				</scroll-view>
			</view>
		</view>

		<BottomNav current="recipe" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import RecipeDateCalendar from '@/components/recipe-date-calendar.vue'
import { getIngredientList } from '@/api/modules/ingredients'
import { createRecipeTask } from '@/api/modules/recipes'
import { getCurrentUserId } from '@/utils/current-user'
import { getMealPlans, removeMealPlan } from '@/store/app-store'
import { deleteMealPlanFromServer, syncMealPlans } from '@/utils/user-data-sync'
import { getProfile } from '@/api/modules/profile'

const RECIPE_PANTRY_CACHE_KEY = 'FFA_RECIPE_PANTRY_CACHE'

function unwrapListPayload(source) {
	if (Array.isArray(source)) return source
	if (source && Array.isArray(source.data)) return source.data
	if (source && source.data && Array.isArray(source.data.data)) return source.data.data
	return []
}

function formatDate(date) {
	const pad = (n) => `${n}`.padStart(2, '0')
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export default {
	components: { BottomNav, IngredientIcon, RecipeDateCalendar },
	data() {
		return {
			activeTab: 'recommend',
			entrySource: '',
			isGenerating: false,
			ingredientPickerVisible: false,
			pantryIngredients: [],
			selectedPantryNames: [],
			customIngredients: [],
			customIngredientInput: '',
			profileAvoidances: [],
			tasteInitializedFromProfile: false,
			tastePreference: '家常',
			cookingTime: 30,
			tasteOptions: ['家常', '清淡', '微辣', '香辣', '酸甜'],
			timeOptions: [
				{ label: '15分钟内', value: 15 },
				{ label: '30分钟内', value: 30 },
				{ label: '1小时内', value: 60 },
				{ label: '不限时间', value: 0 }
			],
			selectedDate: formatDate(new Date()),
			calendarDraftDate: formatDate(new Date()),
			dateCalendarVisible: false,
			allPlans: [],
			mealSections: [
				{ key: 'breakfast', label: '早餐', icon: '/static/meal-icons/breakfast.svg' },
				{ key: 'lunch', label: '午餐', icon: '/static/meal-icons/lunch.svg' },
				{ key: 'dinner', label: '晚餐', icon: '/static/meal-icons/dinner.svg' }
			]
		}
	},
	computed: {
		fromProfile() { return this.entrySource === 'profile' },
		generateButtonText() { return this.isGenerating ? '正在生成…' : 'AI 生成专属菜谱' },
		allPantrySelected() { return this.pantryIngredients.length > 0 && this.selectedPantryNames.length === this.pantryIngredients.length },
		selectedIngredients() {
			const selected = this.pantryIngredients.filter((item) => this.selectedPantryNames.includes(item.name))
			const custom = this.customIngredients.map((name) => ({ name, quantity: 1, unit: '份', category: '其他', isCustom: true }))
			return [...selected, ...custom]
		},
		selectedPreviewItems() { return this.selectedIngredients.slice(0, 4) },
		selectedIngredientNames() {
			const names = this.selectedIngredients.map((item) => item.name)
			if (names.length <= 4) return names.join('、')
			return `${names.slice(0, 4).join('、')}等`
		},
		selectedTimeLabel() { return this.timeOptions.find((item) => item.value === this.cookingTime)?.label || '不限时间' },
		selectedMonthText() {
			const date = new Date(`${this.selectedDate}T00:00:00`)
			return `${date.getFullYear()}年${date.getMonth() + 1}月`
		},
		selectedDateDetail() {
			const date = new Date(`${this.selectedDate}T00:00:00`)
			return `${date.getMonth() + 1}月${date.getDate()}日 · ${['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()]}`
		},
		dayPlans() { return this.allPlans.filter((item) => item.date === this.selectedDate) },
		dateStrip() {
			const center = new Date(`${this.selectedDate}T00:00:00`)
			const today = formatDate(new Date())
			return Array.from({ length: 7 }, (_, index) => {
				const date = new Date(center)
				date.setDate(center.getDate() + index - 3)
				const key = formatDate(date)
				return { date: key, day: date.getDate(), week: ['日', '一', '二', '三', '四', '五', '六'][date.getDay()], isSelected: key === this.selectedDate, isToday: key === today, hasPlan: this.allPlans.some((item) => item.date === key) }
			})
		}
	},
	onLoad(query) {
		this.ensureShareMenu()
		this.entrySource = query?.from === 'profile' ? 'profile' : ''
		this.activeTab = query?.tab === 'plan' ? 'plan' : 'recommend'
		if (query?.date && /^\d{4}-\d{2}-\d{2}$/.test(query.date)) this.selectedDate = query.date
		this.hydratePantryCache()
	},
	onShow() {
		this.ensureShareMenu()
		this.hydratePantryCache()
		this.prefetchPantryIngredients()
		this.loadRecipeProfile()
		this.loadPlans()
	},
	onShareAppMessage() { return { title: '用冰箱食材生成今天的专属菜谱', path: '/pages/recipe/generate' } },
	onShareTimeline() { return { title: '鲜食档案 | 智能菜谱与饮食计划' } },
	methods: {
		backToProfile() {
			const returnToProfile = () => {
				uni.redirectTo({
					url: '/pages/profile/index',
					fail: () => uni.reLaunch({ url: '/pages/profile/index' })
				})
			}
			const pages = getCurrentPages()
			const previousRoute = `${pages?.[pages.length - 2]?.route || ''}`
			if (previousRoute === 'pages/profile/index') {
				uni.navigateBack({ fail: returnToProfile })
				return
			}
			returnToProfile()
		},
		openIngredientPicker() { this.ingredientPickerVisible = true },
		closeIngredientPicker() { this.ingredientPickerVisible = false },
		selectAllPantry() { this.selectedPantryNames = this.pantryIngredients.map((item) => item.name) },
		clearIngredientSelection() { this.selectedPantryNames = []; this.customIngredients = [] },
		isTasteDisabled(taste) { return this.profileAvoidances.includes('辛辣') && ['微辣', '香辣'].includes(taste) },
		selectTaste(taste) {
			if (this.isTasteDisabled(taste)) {
				uni.showToast({ title: '个人资料中已设置忌辛辣', icon: 'none' })
				return
			}
			this.tastePreference = taste
		},
		async loadRecipeProfile() {
			try {
				const profile = await getProfile(getCurrentUserId())
				this.profileAvoidances = Array.isArray(profile?.avoidances) ? profile.avoidances.map((item) => `${item || ''}`.trim()).filter(Boolean) : []
				if (!this.tasteInitializedFromProfile) {
					const legacyPreferences = Array.isArray(profile?.dietPreferences) ? profile.dietPreferences : []
					if (legacyPreferences.includes('清淡')) this.tastePreference = '清淡'
					this.tasteInitializedFromProfile = true
				}
				if (this.isTasteDisabled(this.tastePreference)) this.tastePreference = '家常'
			} catch (_) {}
		},
		ensureShareMenu() {
			if (typeof uni === 'undefined' || typeof uni.showShareMenu !== 'function') return
			try { uni.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] }) } catch (_) {}
		},
		switchTab(tab) { this.activeTab = tab; if (tab === 'plan') this.loadPlans() },
		async loadPlans() {
			this.allPlans = getMealPlans()
			try {
				this.allPlans = await syncMealPlans()
			} catch (_) {
				this.allPlans = getMealPlans()
			}
		},
		plansForMeal(meal) { return this.dayPlans.filter((item) => item.meal === meal) },
		openPlanRecipe(plan) {
			const name = `${plan?.recipeName || ''}`.trim()
			if (!name) return
			if (plan?.recipe && typeof plan.recipe === 'object') {
				uni.setStorageSync('latestRecipeDetail', plan.recipe)
			} else {
				uni.removeStorageSync('latestRecipeDetail')
			}
			const returnSource = this.fromProfile ? '&planReturnSource=profile' : ''
			const target = `/pages/recipe/detail?name=${encodeURIComponent(name)}&fromPlan=1&planId=${encodeURIComponent(plan.id)}&planDate=${encodeURIComponent(this.selectedDate)}${returnSource}`
			uni.navigateTo({
				url: target,
				fail: () => uni.redirectTo({ url: target, fail: () => uni.reLaunch({ url: target }) })
			})
		},
		pickPlanRecipeIconName(plan) {
			const first = Array.isArray(plan?.recipe?.ingredients) ? plan.recipe.ingredients.find((item) => item?.name)?.name : ''
			if (first) return first
			const name = `${plan?.recipeName || ''}`
			if (name.includes('番茄') || name.includes('西红柿')) return '番茄'
			if (name.includes('土豆')) return '土豆'
			if (name.includes('鸡蛋')) return '鸡蛋'
			if (name.includes('牛')) return '牛肉'
			if (name.includes('鸡')) return '鸡肉'
			return name
		},
		selectDate(date) {
			this.selectedDate = date
			this.calendarDraftDate = date
		},
		openDateCalendar() {
			this.calendarDraftDate = this.selectedDate
			this.dateCalendarVisible = true
		},
		closeDateCalendar() { this.dateCalendarVisible = false },
		confirmDateCalendar() {
			this.selectedDate = this.calendarDraftDate
			this.dateCalendarVisible = false
		},
		confirmRemovePlan(plan) {
			uni.showModal({
				title: '移除计划',
				content: `确认从当天安排中移除“${plan.recipeName}”吗？`,
				success: async (res) => {
					if (!res.confirm) return
					removeMealPlan(plan.id)
					this.allPlans = getMealPlans()
					try { await deleteMealPlanFromServer(plan.id) } catch (_) {}
					this.loadPlans()
					uni.showToast({ title: '已移除', icon: 'success' })
				}
			})
		},
		hydratePantryCache() {
			try {
				const cached = uni.getStorageSync(RECIPE_PANTRY_CACHE_KEY)
				if (!Array.isArray(cached)) return
				this.pantryIngredients = cached
				if (!this.selectedPantryNames.length) this.selectedPantryNames = cached.map((item) => item.name)
			} catch (_) {}
		},
		persistPantryCache(list) { try { uni.setStorageSync(RECIPE_PANTRY_CACHE_KEY, Array.isArray(list) ? list : []) } catch (_) {} },
		normalizeIngredients(list) {
			const unique = new Map()
			for (const item of (Array.isArray(list) ? list : [])) {
				const name = `${item?.name || ''}`.trim()
				if (!name || unique.has(name)) continue
				unique.set(name, { name, quantity: Number(item.quantity || 1), unit: item.unit || '', category: `${item.category || ''}`.trim() })
			}
			return [...unique.values()]
		},
		async prefetchPantryIngredients() {
			try {
				const listRes = await getIngredientList({ userId: getCurrentUserId() })
				const ingredients = this.normalizeIngredients(unwrapListPayload(listRes))
				const previousNames = this.pantryIngredients.map((item) => item.name)
				const wasAllSelected = previousNames.length === 0 || previousNames.every((name) => this.selectedPantryNames.includes(name))
				this.pantryIngredients = ingredients
				if (wasAllSelected) this.selectedPantryNames = ingredients.map((item) => item.name)
				else this.selectedPantryNames = this.selectedPantryNames.filter((name) => ingredients.some((item) => item.name === name))
				this.persistPantryCache(ingredients)
			} catch (_) {}
		},
		isIngredientSelected(name) { return this.selectedPantryNames.includes(name) },
		toggleIngredient(name) {
			this.selectedPantryNames = this.isIngredientSelected(name) ? this.selectedPantryNames.filter((item) => item !== name) : [...this.selectedPantryNames, name]
		},
		toggleAllPantry() { this.selectedPantryNames = this.allPantrySelected ? [] : this.pantryIngredients.map((item) => item.name) },
		addCustomIngredient() {
			const name = `${this.customIngredientInput || ''}`.trim().replace(/\s+/g, '')
			if (!name) return
			if (this.customIngredients.includes(name) || this.pantryIngredients.some((item) => item.name === name)) { uni.showToast({ title: '该食材已经存在', icon: 'none' }); return }
			this.customIngredients.push(name)
			this.customIngredientInput = ''
		},
		removeCustomIngredient(name) { this.customIngredients = this.customIngredients.filter((item) => item !== name) },
		openRecipeResultPage(taskId = '') {
			const query = taskId ? `?taskId=${encodeURIComponent(taskId)}` : ''
			const targetUrl = `/pages/recipe/result${query}`
			const pages = getCurrentPages()
			const redirect = () => uni.redirectTo({ url: targetUrl, fail: () => uni.reLaunch({ url: targetUrl }) })
			if (Array.isArray(pages) && pages.length >= 9) { redirect(); return }
			uni.navigateTo({ url: targetUrl, fail: (err) => `${err?.errMsg || ''}`.includes('webview count limit exceed') ? redirect() : uni.showToast({ title: '页面跳转失败', icon: 'none' }) })
		},
		async generate() {
			if (this.isGenerating) return
			const ingredients = this.normalizeIngredients(this.selectedIngredients)
			if (!ingredients.length) { uni.showToast({ title: '请至少选择一种食材', icon: 'none' }); return }
			this.isGenerating = true
			try {
				const taskRes = await createRecipeTask({ userId: getCurrentUserId(), ingredients, tastePreference: this.tastePreference, cookingTime: this.cookingTime || 120, count: 6 })
				const taskId = `${taskRes?.data?.taskId || taskRes?.taskId || ''}`.trim()
				if (!taskId) { uni.showToast({ title: '创建生成任务失败，请重试', icon: 'none' }); return }
				uni.setStorageSync('latestGeneratedRecipes', [])
				uni.setStorageSync('latestGeneratedBatchId', `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
				uni.setStorageSync('latestRecipeProfileApplied', null)
				uni.setStorageSync('latestPantryTags', ingredients.slice(0, 6).map((x) => x.name))
				uni.setStorageSync('latestPantryIngredients', ingredients)
				uni.setStorageSync('latestRecipePreferences', { tastePreference: this.tastePreference, cookingTime: this.cookingTime, cookingTimeLabel: this.selectedTimeLabel })
				this.openRecipeResultPage(taskId)
			} catch (e) {
				console.error('生成失败', e)
				uni.showToast({ title: `${e?.message || e?.msg || e?.data?.message || '生成失败，请稍后重试'}`, icon: 'none' })
			} finally { this.isGenerating = false }
		}
	}
}
</script>

<style scoped>
.container { min-height: 100vh; box-sizing: border-box; padding: 10px 12px 96px; background: #f6f7f8; }
.top { display: flex; align-items: center; min-height: 34px; }
.top-title-wrap { display: flex; align-items: center; }
.back-left { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin-right: 2rpx; border-radius: 999rpx; }
.back-arrow { color: #c7ced9; font-size: 30px; line-height: 1; transform: translateY(-1px); }
.top-title { color: #1b2420; font-size: 20px; font-weight: 800; }
.page-tabs { display: grid; grid-template-columns: 1fr 1fr; margin: 10rpx 0 46rpx; border-bottom: 1rpx solid #e4ebe5; }
.page-tab { position: relative; padding: 18rpx 10rpx 20rpx; color: #8b958e; font-size: 14px; font-weight: 600; text-align: center; }
.page-tab.active { color: #3f9a4d; font-weight: 800; }
.page-tab.active::after { content: ''; position: absolute; left: 50%; bottom: -1rpx; width: 58rpx; height: 4rpx; border-radius: 999rpx; background: #57af61; transform: translateX(-50%); }
.recipe-screen { position: relative; padding: 12px; border: 1rpx solid #e8ece8; border-radius: 20px; background: #fff; box-shadow: 0 12rpx 28rpx rgba(38,61,43,.08); }
.recipe-cover-badge { position: absolute; left: 50%; top: -34rpx; z-index: 2; display: flex; align-items: center; justify-content: center; width: 82rpx; height: 68rpx; border: 1rpx solid #d6e8d8; border-radius: 15px 15px 10px 10px; background: #f1faf2; box-shadow: 0 7rpx 15rpx rgba(64,126,72,.13); transform: translateX(-50%); }
.recipe-cover-icon { color: #4cae57; font-family: "iconfont" !important; font-size: 30px; line-height: 1; }
.recipe-paper { position: relative; overflow: hidden; padding: 52rpx 26rpx 56rpx; border: 1rpx solid #dfe9df; border-radius: 16px; background: #fffdf8; box-shadow: inset 0 0 0 7rpx #f8faf5, 0 8rpx 16rpx rgba(33,60,38,.05); }
.recipe-paper::before,.recipe-paper::after { content: ''; position: absolute; width: 66rpx; height: 66rpx; pointer-events: none; }
.recipe-paper::before { left: 22rpx; top: 22rpx; border-top: 2rpx solid rgba(76,174,87,.2); border-left: 2rpx solid rgba(76,174,87,.2); border-radius: 12rpx 0 0; }
.recipe-paper::after { right: 22rpx; bottom: 22rpx; border-right: 2rpx solid rgba(76,174,87,.2); border-bottom: 2rpx solid rgba(76,174,87,.2); border-radius: 0 0 12rpx; }
.menu-heading { display: flex; flex-direction: column; align-items: center; padding: 4rpx 0 28rpx; text-align: center; }
.menu-kicker { color: #91a497; font-size: 9px; font-weight: 800; letter-spacing: 4rpx; }
.menu-title { margin-top: 9rpx; color: #1d252f; font-size: 20px; font-weight: 800; letter-spacing: 1rpx; }
.menu-divider { display: flex; align-items: center; gap: 12rpx; width: 220rpx; margin-top: 14rpx; }
.menu-divider-line { flex: 1; height: 1rpx; background: #d8e5d9; }
.menu-divider-mark { color: #6bbb73; font-size: 7px; }
.menu-meta { margin-top: 10rpx; color: #7a867e; font-size: 11px; line-height: 1.7; }
.setting-card { position: relative; margin: 0; padding: 24rpx 2rpx; border-top: 1rpx solid #e7ece7; }
.setting-card.compact { padding: 24rpx 2rpx; }
.section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16rpx; }
.section-title { display: block; color: #263029; font-size: 14px; font-weight: 800; }
.select-all { flex-shrink: 0; color: #4ba45a; font-size: 11px; }
.modify-ingredients { flex-shrink: 0; padding: 4rpx 0 8rpx 16rpx; color: #4b9b57; font-size: 11px; font-weight: 700; }
.ingredient-summary { display: flex; align-items: center; gap: 18rpx; margin-top: 20rpx; padding: 18rpx; border: 1rpx solid #e0e9e2; border-radius: 13px; background: rgba(255,255,255,.72); }
.ingredient-preview-list { display: flex; align-items: center; flex-shrink: 0; padding-left: 8rpx; }
.ingredient-preview { position: relative; display: flex; align-items: center; justify-content: center; width: 62rpx; height: 62rpx; margin-left: -8rpx; overflow: hidden; border: 3rpx solid #fffdf8; border-radius: 50%; background: #edf7ef; box-shadow: 0 3rpx 8rpx rgba(41,78,47,.08); }
.ingredient-preview.more { color: #56865d; background: #e8f3ea; font-size: 10px; font-weight: 800; }
.ingredient-summary-copy { min-width: 0; flex: 1; }
.ingredient-summary-count { display: block; color: #364239; font-size: 12px; font-weight: 800; }
.ingredient-summary-names { display: block; margin-top: 7rpx; overflow: hidden; color: #8a948d; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.ingredient-summary.empty { flex-direction: column; align-items: flex-start; gap: 7rpx; color: #8b968e; font-size: 10px; }
.ingredient-summary.empty text:first-child { color: #4d9757; font-size: 12px; font-weight: 700; }
.chip-list { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 18rpx; }
.chip { padding: 10rpx 16rpx; border: 1rpx solid #dfe7e1; border-radius: 999rpx; color: #707a73; background: #fafbf9; font-size: 11px; line-height: 1; }
.chip.selected { color: #438d4e; border-color: #a8d8ae; background: #f1f9f2; font-weight: 700; }
.custom-list { display: flex; flex-wrap: wrap; gap: 10rpx; margin-top: 14rpx; padding-top: 14rpx; border-top: 1rpx dashed #e6ebe7; }
.custom-chip { color: #5b8f62; }
.custom-input-row { display: grid; grid-template-columns: 1fr 96rpx; gap: 10rpx; margin-top: 18rpx; }
.custom-input { height: 66rpx; box-sizing: border-box; padding: 0 18rpx; border: 1rpx solid #dfe7e1; border-radius: 10px; color: #283129; background: #fff; font-size: 11px; }
.add-btn { height: 66rpx; margin: 0; padding: 0; border: 1rpx solid #d8e9da; border-radius: 10px; color: #4a9655; background: #f1f8f2; font-size: 11px; font-weight: 700; line-height: 66rpx; }
.add-btn::after { border: none; }
.empty-inline { margin-top: 18rpx; color: #9aa39d; font-size: 11px; }
.option-list { margin-top: 16rpx; }
.option-chip { min-width: 104rpx; box-sizing: border-box; text-align: center; }
.option-chip.disabled { color: #b4bbb6; border-color: #e6e9e7; background: #f3f4f3; text-decoration: line-through; }
.taste-section-head { align-items: center; }
.generate-btn { margin-top: 18rpx; padding: 12px; border: none; border-radius: 13px; color: #fff; background: linear-gradient(135deg,#70c977,#4cae57); box-shadow: 0 8rpx 16rpx rgba(58,116,66,.18); font-size: 13px; font-weight: 800; }
.generate-btn::after { border: none; }
.ingredient-picker-mask { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: flex-end; background: rgba(20,29,23,.46); }
.ingredient-picker { display: flex; width: 100%; height: 78vh; max-height: 1120rpx; box-sizing: border-box; flex-direction: column; padding: 28rpx 24rpx calc(26rpx + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; background: #fffdf9; box-shadow: 0 -12rpx 38rpx rgba(18,37,22,.16); }
.ingredient-picker-head { display: flex; align-items: center; justify-content: space-between; padding: 0 4rpx 22rpx; border-bottom: 1rpx solid #e5ebe6; }
.ingredient-picker-title { display: block; color: #202a22; font-size: 18px; font-weight: 800; }
.ingredient-picker-sub { display: block; margin-top: 6rpx; color: #8b958e; font-size: 10px; }
.ingredient-picker-done { padding: 12rpx 8rpx 12rpx 20rpx; color: #459852; font-size: 13px; font-weight: 800; }
.picker-tools { display: flex; align-items: center; justify-content: space-between; padding: 22rpx 4rpx 16rpx; }
.picker-section-title { color: #3b463e; font-size: 12px; font-weight: 800; }
.picker-tool-actions { display: flex; gap: 24rpx; color: #4d9958; font-size: 11px; }
.ingredient-picker-body { flex: 1; height: 0; min-height: 0; }
.ingredient-grid-wrap { padding-bottom: 8rpx; }
.ingredient-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14rpx; padding: 2rpx 2rpx 20rpx; }
.ingredient-grid-item { position: relative; display: flex; min-width: 0; height: 146rpx; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; box-sizing: border-box; border: 1rpx solid #e3e9e4; border-radius: 14px; background: #fafbf9; }
.ingredient-grid-item.selected { border-color: #9bd2a2; background: #eff8f0; box-shadow: inset 0 0 0 1rpx rgba(89,171,99,.08); }
.ingredient-grid-icon { display: flex; align-items: center; justify-content: center; width: 72rpx; height: 72rpx; border-radius: 50%; background: #fff; }
.ingredient-grid-name { width: 90%; overflow: hidden; color: #667169; font-size: 10px; text-align: center; text-overflow: ellipsis; white-space: nowrap; }
.ingredient-grid-item.selected .ingredient-grid-name { color: #3e8348; font-weight: 700; }
.ingredient-check { position: absolute; top: 8rpx; right: 8rpx; display: flex; align-items: center; justify-content: center; width: 28rpx; height: 28rpx; border-radius: 50%; color: #fff; background: #55ad61; font-size: 8px; font-weight: 800; }
.picker-empty { display: flex; align-items: center; justify-content: center; height: 300rpx; color: #9ba49e; font-size: 11px; }
.picker-custom-area { padding: 20rpx 4rpx 0; border-top: 1rpx solid #e5ebe6; }
.picker-custom-area .custom-input-row { margin-top: 14rpx; }
.custom-ingredient-grid { margin-top: 18rpx; padding-bottom: 10rpx; }
.plan-date-card { padding: 24rpx 20rpx 18rpx; border: 1rpx solid #e8efea; border-radius: 18px; background: #fff; box-shadow: 0 8rpx 22rpx rgba(39,76,45,.05); }
.plan-date-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20rpx; }
.plan-month { display: block; color: #202a22; font-size: 18px; font-weight: 800; }
.plan-date-sub { display: block; margin-top: 6rpx; color: #89938c; font-size: 11px; }
.calendar-btn { padding: 12rpx 18rpx; border-radius: 999rpx; color: #4b9a57; background: #edf7ef; font-size: 11px; font-weight: 700; }
.date-calendar-mask { position: fixed; inset: 0; z-index: 2200; display: flex; align-items: flex-end; background: rgba(20,29,23,.48); }
.date-calendar-modal { width: 100%; max-height: 88vh; overflow-y: auto; box-sizing: border-box; padding: 30rpx 26rpx calc(36rpx + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; background: #fff; box-shadow: 0 -12rpx 38rpx rgba(18,37,22,.16); }
.date-calendar-modal-head { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 28rpx; }
.date-calendar-modal-title { color: #202a22; font-size: 18px; font-weight: 800; }
.date-calendar-modal-close { padding: 0 8rpx; color: #9ba39d; font-size: 28px; line-height: 1; }
.date-calendar-confirm { width: 88%; margin: 28rpx auto 0; padding: 13px 12px; border: none; border-radius: 14px; color: #fff; background: linear-gradient(135deg,#70c977,#4cae57); box-shadow: 0 9rpx 18rpx rgba(58,116,66,.19); font-size: 14px; font-weight: 800; }
.date-calendar-confirm::after { border: none; }
.date-strip { width: 100%; white-space: nowrap; }
.date-strip-inner { display: inline-flex; min-width: 100%; justify-content: space-between; gap: 7rpx; }
.date-item { position: relative; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; width: 76rpx; height: 104rpx; border-radius: 13px; color: #78837b; background: #f7f9f7; }
.date-item.date-today { color: #4d9d58; box-shadow: inset 0 0 0 1rpx #b9d9be; }
.date-item.date-selected { color: #fff; background: linear-gradient(160deg,#71ca7a,#4daf5b); box-shadow: 0 7rpx 14rpx rgba(68,159,81,.2); }
.date-selected-fill { position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 13px; background-color: #56b962; box-shadow: 0 7rpx 14rpx rgba(68,159,81,.2); }
.date-week { position: relative; z-index: 1; font-size: 10px; }
.date-day { position: relative; z-index: 1; margin-top: 7rpx; font-size: 16px; font-weight: 800; }
.selected-date-text { color: #fff; }
.plan-dot { position: absolute; bottom: 8rpx; width: 7rpx; height: 7rpx; border-radius: 50%; background: #58b665; }
.selected-plan-dot { z-index: 2; background: #fff; }
.date-item.date-selected .plan-dot { background: #fff; }
.day-summary { display: flex; justify-content: space-between; align-items: center; margin: 28rpx 6rpx 14rpx; }
.day-summary-title { color: #222c25; font-size: 16px; font-weight: 800; }
.meal-card { margin-bottom: 14rpx; padding: 20rpx; border: 1rpx solid #e8efea; border-radius: 17px; background: #fff; }
.meal-head, .meal-name-wrap { display: flex; align-items: center; }
.meal-head { justify-content: space-between; }
.meal-name-wrap { gap: 14rpx; }
.meal-icon { display: flex; align-items: center; justify-content: center; width: 60rpx; height: 60rpx; border-radius: 12px; background: #edf7ef; }
.meal-icon image { display: block; width: 38rpx; height: 38rpx; }
.meal-name { display: block; color: #283129; font-size: 14px; font-weight: 800; }
.meal-count { color: #8b958e; font-size: 10px; }
.meal-recipes { margin-top: 18rpx; border-top: 1rpx solid #edf1ee; }
.plan-recipe { display: flex; align-items: center; gap: 13rpx; padding-top: 18rpx; }
.plan-recipe.completed .recipe-mark { opacity: .62; }
.plan-recipe.completed .plan-recipe-name { color: #718078; text-decoration: line-through; }
.plan-recipe.completed .plan-recipe-meta { color: #4fa15b; font-weight: 700; }
.recipe-mark { display: flex; align-items: center; justify-content: center; width: 64rpx; height: 64rpx; border: 1rpx solid #e0ece2; border-radius: 12px; background: #f1f8f2; }
.plan-recipe-main { flex: 1; min-width: 0; }
.plan-recipe-name { display: block; overflow: hidden; color: #334037; font-size: 12px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.plan-recipe-meta { display: block; margin-top: 5rpx; color: #909991; font-size: 9px; }
.remove-plan { padding: 10rpx; color: #b78669; font-size: 10px; }
.meal-empty { margin-top: 17rpx; padding: 18rpx; border: 1rpx dashed #dbe6dd; border-radius: 12px; color: #819087; background: #fafbfa; font-size: 11px; text-align: center; }
.meal-empty text { margin-right: 5rpx; color: #51a85e; font-size: 15px; }
</style>
