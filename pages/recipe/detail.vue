<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back-left" @click="backToResult">
				<text class="back-arrow">‹</text>
			</view>
			<text class="top-title">菜谱详情</text>
		</view>
		<view class="recipe-inner">
			<view class="head">
				<view class="recipe-avatar">
					<IngredientIcon :name="pickRecipeCoverName(recipe)" :size="46" />
				</view>
				<view class="head-main">
					<view class="title-video-link" hover-class="title-video-link-active" @click="copyVideoSearchKeyword">
						<text class="title">{{ recipe.name }}</text>
						<view class="video-play-icon" aria-label="复制视频搜索词"></view>
					</view>
					<text class="meta">{{ recipe.servings }}人份 · {{ recipe.duration }}分钟 · {{ recipe.difficulty }}</text>
				</view>
				<button v-if="fromFavorite && favorited" class="head-unfavorite-btn" @click="unfavorite">取消收藏</button>
			</view>
			<view v-if="hasIngredientSection" class="recipe-banner">
				<view class="banner-title-row">
					<text class="banner-title">所需食材</text>
					<text class="banner-count" :class="{ missing: missingIngredientCount > 0 }">{{ ingredientAvailabilityText }}</text>
				</view>
				<text v-if="pantryLoadState === 'loading'" class="ingredient-status-text">正在核对冰箱库存…</text>
				<text v-else-if="pantryLoadState === 'error'" class="ingredient-status-text error">暂时无法读取冰箱库存，请稍后重试</text>
				<view v-if="availableIngredientItems.length" class="ingredient-group available">
					<text class="ingredient-group-label">冰箱已有</text>
					<text class="ingredient-group-text">{{ formatIngredientItems(availableIngredientItems) }}</text>
				</view>
				<view v-if="missingIngredientItems.length" class="ingredient-group missing">
					<text class="ingredient-group-label">还需准备</text>
					<text class="ingredient-group-text">{{ formatIngredientItems(missingIngredientItems) }}</text>
					<button class="ingredient-basket-btn" @click.stop="addMissingToBasket"><text class="basket-action-icon">&#xe61b;</text><text>加入菜篮子</text></button>
				</view>
			</view>
			<view v-if="stepsLoading" class="detail-loading-card">
				<view class="detail-loading-dot"></view>
				<view>
					<text class="detail-loading-title">正在生成详细步骤</text>
					<text class="detail-loading-meta">正在结合知识库校验火候、时间和食材使用…</text>
				</view>
			</view>
			<view v-else-if="fromFavorite && favoriteSyncing && !hasRecipeDetail" class="detail-loading-card">
				<view class="detail-loading-dot"></view>
				<view>
					<text class="detail-loading-title">正在读取收藏内容</text>
					<text class="detail-loading-meta">食材库存会按当前冰箱重新核对</text>
				</view>
			</view>
			<view v-else-if="fromFavorite && !hasRecipeDetail" class="detail-error-card favorite-legacy-card">
				<text class="detail-error-text">这份早期收藏暂时无法完成升级，请稍后再试。</text>
			</view>
			<view v-else-if="stepsError" class="detail-error-card">
				<text class="detail-error-text">{{ stepsError }}</text>
			</view>
			<view v-if="hasRecipeDetail" class="step-card">
				<view class="step-head">
					<text class="step-title">步骤</text>
					<view class="step-head-actions">
						<text class="step-meta">共{{ recipe.steps.length }}步</text>
						<view class="read-step-btn" @click="toggleRecipeSpeech">
							<text>{{ isRecipeSpeaking ? '停止朗读' : (isRecipeSynthesizing ? '生成中…' : '朗读步骤') }}</text>
						</view>
					</view>
				</view>
				<view class="step-list">
					<view v-for="(step, idx) in recipe.steps" :key="idx" class="step-item">
						<text class="step-no">{{ idx + 1 }}</text>
						<text class="step-line">{{ formatStepText(step) }}</text>
					</view>
				</view>
			</view>
			<view v-if="hasRecipeDetail && nutritionLoading" class="detail-loading-card">
				<view class="detail-loading-dot"></view>
				<view>
					<text class="detail-loading-title">正在估算营养成分</text>
					<text class="detail-loading-meta">正在计算每人份六项营养数据，请稍候…</text>
				</view>
			</view>
			<view v-if="hasRecipeDetail && nutritionError" class="detail-error-card">
				<text class="detail-error-text">{{ nutritionError }}</text>
			</view>
			<view v-if="hasRecipeDetail && hasNutrition" class="nutrition-card">
				<view class="nutrition-head">
					<text class="nutrition-title">营养元素</text>
					<text class="nutrition-serving">每人份估算</text>
				</view>
				<view class="nutrition-grid">
					<view v-for="item in nutritionItems" :key="item.key" class="nutrition-item">
						<NutritionIcon class="nutrition-icon" :file="item.iconFile" :fallback="item.fallback" :color="item.color" :size="15" />
						<text class="nutrition-label">{{ item.label }}</text>
						<text class="nutrition-value">{{ item.value }}</text>
						<text class="nutrition-unit">{{ item.unit }}</text>
					</view>
				</view>
				<text v-if="recipe.nutrition.analysis" class="nutrition-analysis"><text class="nutrition-analysis-label">营养分析：</text>{{ recipe.nutrition.analysis }}</text>
				<text class="nutrition-disclaimer">营养数据为 AI 估算值，仅供日常饮食参考。</text>
			</view>
		</view>
		<view v-if="hasRecipeDetail" class="favorite-wrap">
			<view class="action-grid">
				<button v-if="!fromFavorite" class="recipe-action-btn favorite-action" :class="{ active: favorited }" @click="favorite"><text class="action-symbol favorite-symbol">&#xe62e;</text><text>{{ favorited ? '已收藏' : '收藏菜谱' }}</text></button>
				<button v-else-if="!fromPlan" class="recipe-action-btn plan-action" @click="openPlanModal"><text class="action-symbol">＋</text><text>加入计划</text></button>
				<button class="recipe-action-btn complete-cook-action" :disabled="completionSubmitting || completionDone" @click="openCompletionModal">
					<text class="complete-cook-icon">&#xe66a;</text>
					<text>{{ completionDone ? '已完成制作' : '完成制作' }}</text>
				</button>
			</view>
			<button v-if="!fromFavorite && !fromPlan" class="recipe-action-btn plan-action plan-wide-action" @click="openPlanModal"><text class="action-symbol">＋</text><text>加入计划</text></button>
			<text v-if="fromFavorite && lastCompletedAt" class="complete-meta">最近完成：{{ formatDateTime(lastCompletedAt) }}</text>
		</view>
		<view v-if="planModalVisible" class="modal-mask" @click="closePlanModal">
			<view class="plan-modal" @click.stop>
				<view class="modal-head">
					<text class="modal-title">加入饮食计划</text>
					<text class="modal-close" @click="closePlanModal">×</text>
				</view>
				<RecipeDateCalendar v-model="planDate" label="用餐日期" />
				<text class="field-label">选择餐次</text>
				<view class="meal-options">
					<view v-for="item in planMealOptions" :key="item.value" class="meal-option" :class="{ active: planMeal === item.value }" @click="planMeal = item.value">
						<image class="meal-option-icon" :src="item.icon" mode="aspectFit" /><text>{{ item.label }}</text>
					</view>
				</view>
				<button class="confirm-plan-btn" @click="confirmAddPlan">确认加入</button>
			</view>
		</view>
		<view v-if="completionModalVisible" class="modal-mask completion-mask" @click="closeCompletionModal">
			<view class="completion-modal" @click.stop>
				<text class="completion-title">食材取出数量</text>
				<text class="completion-modal-sub">仅扣减本次使用的主要食材，调料不计入</text>
				<scroll-view class="completion-list" scroll-y :show-scrollbar="false">
					<view v-for="(item, index) in completionItems" :key="item.id" class="completion-item">
						<view class="completion-item-main">
							<text class="completion-item-name">{{ item.name }}</text>
							<text class="completion-item-meta">现有 {{ formatPlainNumber(item.stock) }}{{ item.unit }}</text>
						</view>
						<view class="completion-quantity">
							<button class="quantity-step" @click="adjustCompletionQuantity(index, -1)">−</button>
							<input class="quantity-input" type="digit" :value="item.quantity" @input="onCompletionQuantityInput(index, $event)" />
							<button class="quantity-step" @click="adjustCompletionQuantity(index, 1)">＋</button>
							<text class="quantity-unit">{{ item.unit }}</text>
						</view>
					</view>
					<view v-if="!completionItems.length" class="completion-empty">菜谱食材暂时没有匹配到冰箱库存，本次只标记为已完成。</view>
					<view v-if="completionUnmatchedNames.length" class="completion-unmatched">以下食材未自动扣减，请在冰箱中手动处理：{{ completionUnmatchedNames.join('、') }}</view>
				</scroll-view>
				<view class="completion-actions">
					<button class="completion-cancel-btn" :disabled="completionSubmitting" @click="closeCompletionModal">取消</button>
					<button class="confirm-completion-btn" :loading="completionSubmitting" :disabled="completionSubmitting" @click="confirmCompletion">确认取出</button>
				</view>
			</view>
		</view>
		<BottomNav current="recipe" />
	</view>
</template>

<script>
import {
	addFavoriteRecipe,
	getFavoriteRecipeByName,
	markFavoriteRecipeCompleted,
	removeFavoriteRecipe,
	upsertBasketItems as upsertBasketItemsLocal,
	addMealPlan,
	markMealPlanCompleted
} from '@/store/app-store'
import { consumeIngredientsBatch, getIngredientList } from '@/api/modules/ingredients'
import { upsertBasketItems as upsertBasketItemsApi } from '@/api/modules/basket'
import { getRecipeNutrition, getRecipeSteps } from '@/api/modules/recipes'
import { synthesizeAssistantSpeech } from '@/api/modules/ai'
import { configureSpeechAudio, playSpeechAudio } from '@/utils/speech-audio'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import NutritionIcon from '@/components/nutrition-icon.vue'
import RecipeDateCalendar from '@/components/recipe-date-calendar.vue'
import { toSmartBasketItem } from '@/utils/smart-purchase'
import {
	completeFavoriteOnServer,
	completeMealPlanOnServer,
	deleteFavoriteFromServer,
	saveFavoriteToServer,
	saveMealPlanToServer,
	syncFavoriteRecipes
} from '@/utils/user-data-sync'

const RECIPE_DETAIL_QUALITY_VERSION = 6
const RECIPE_DETAIL_CACHE_PREFIX = `FFA_RECIPE_DETAIL_V${RECIPE_DETAIL_QUALITY_VERSION}_`

export default {
	components: { BottomNav, IngredientIcon, NutritionIcon, RecipeDateCalendar },
	data() {
		return {
			fromFavorite: false,
			fromPlan: false,
			fromResult: false,
			planSourceId: '',
			planSourceDate: '',
			planReturnSource: '',
			favorited: false,
			favoriteSyncing: false,
			stepsLoading: false,
			nutritionLoading: false,
			stepsError: '',
			nutritionError: '',
			pendingNutrition: null,
			nutritionRevealTimer: null,
			detailRequestId: 0,
			completedCount: 0,
			lastCompletedAt: '',
			isRecipeSynthesizing: false,
			isRecipeSpeaking: false,
			recipeAudioPlaybackStarted: false,
			recipeAudioContext: null,
			pantryNames: [],
			pantryItems: [],
			pantryLoadState: 'loading',
			completionModalVisible: false,
			completionItems: [],
			completionUnmatchedNames: [],
			completionSubmitting: false,
			completionDone: false,
			planModalVisible: false,
			planDate: '',
			planMeal: 'dinner',
			planMealOptions: [
				{ value: 'breakfast', label: '早餐', icon: '/static/meal-icons/breakfast.svg' },
				{ value: 'lunch', label: '午餐', icon: '/static/meal-icons/lunch.svg' },
				{ value: 'dinner', label: '晚餐', icon: '/static/meal-icons/dinner.svg' }
			],
			recipe: {
				name: '番茄炒蛋',
				duration: 12,
				difficulty: '简单',
				servings: 2,
				ingredients: [],
				ingredientsText: '食材信息加载中',
				steps: [],
				nutrition: null,
				raw: null
			}
		}
	},
	computed: {
		planDateText() {
			if (!this.planDate) return '请选择日期'
			const date = new Date(`${this.planDate}T00:00:00`)
			return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
		},
		hasRecipeDetail() {
			return Array.isArray(this.recipe.steps) && this.recipe.steps.length > 0
		},
		hasNutrition() {
			return !!this.recipe?.nutrition && this.nutritionItems.some((item) => Number(item.rawValue) > 0)
		},
		isRecipeContentReady() {
			return this.hasRecipeDetail && this.hasNutrition && this.ingredientDisplayItems.length > 0
		},
		hasIngredientSection() {
			return this.ingredientDisplayItems.length > 0
		},
		availableIngredientItems() {
			return this.ingredientDisplayItems.filter((item) => item.isMissing === false)
		},
		missingIngredientItems() {
			return this.ingredientDisplayItems.filter((item) => item.isMissing === true)
		},
		missingIngredientCount() {
			return this.missingIngredientItems.length
		},
		ingredientAvailabilityText() {
			if (this.pantryLoadState === 'loading') return '核对中'
			if (this.pantryLoadState === 'error') return '库存暂不可用'
			return this.missingIngredientCount > 0 ? `还需${this.missingIngredientCount}种` : '食材齐全'
		},
		ingredientDisplayItems() {
			const canComparePantry = this.pantryLoadState === 'ready' || this.pantryLoadState === 'fallback'
			const withAvailability = (item) => ({
				...item,
				isMissing: canComparePantry ? !this.isIngredientAvailableNow(item) : null
			})
			const rawItems = Array.isArray(this.recipe?.raw?.ingredients)
				? this.recipe.raw.ingredients.map((item) => {
					const name = `${item?.name || ''}`.trim()
					const quantity = item?.quantity === undefined || item?.quantity === null ? '' : `${item.quantity}`.trim()
					const unit = `${item?.unit || ''}`.trim()
					return { name, quantity, unit, amount: `${quantity}${unit}`.trim() }
				}).filter((item) => !!item.name).map(withAvailability)
				: []
			if (rawItems.length) return rawItems
			return (Array.isArray(this.recipe?.ingredients) ? this.recipe.ingredients : [])
				.map((item) => ({ name: `${item || ''}`.trim(), amount: '' }))
				.filter((item) => !!item.name)
				.map(withAvailability)
		},
		nutritionItems() {
			const value = this.recipe?.nutrition || {}
			return [
				{ key: 'calories', iconFile: 'reliang', fallback: '🔥', color: '#ff7200', label: '热量', rawValue: value.calories, value: this.formatNutritionValue(value.calories), unit: 'kcal' },
				{ key: 'protein', iconFile: 'danbaizhi', fallback: '●', color: '#a9ada9', label: '蛋白质', rawValue: value.protein, value: this.formatNutritionValue(value.protein), unit: 'g' },
				{ key: 'fat', iconFile: 'zhifangyouheruhuazhifangzhipin', fallback: '💧', color: '#f59a00', label: '脂肪', rawValue: value.fat, value: this.formatNutritionValue(value.fat), unit: 'g' },
				{ key: 'carbohydrates', iconFile: 'xiaomai', fallback: '🌾', color: '#e9aa13', label: '碳水化合物', rawValue: value.carbohydrates, value: this.formatNutritionValue(value.carbohydrates), unit: 'g' },
				{ key: 'fiber', iconFile: 'yezi1', fallback: '🌿', color: '#58ae67', label: '膳食纤维', rawValue: value.fiber, value: this.formatNutritionValue(value.fiber), unit: 'g' },
				{ key: 'sodium', iconFile: '', fallback: 'Na', color: '#58ae67', label: '钠', rawValue: value.sodium, value: this.formatNutritionValue(value.sodium), unit: 'mg' }
			]
		}
	},
	onLoad(query) {
		this.ensureShareMenu()
		this.initRecipeAudio()
		this.fromFavorite = !!(query && query.fromFavorite === '1')
		this.fromPlan = !!(query && query.fromPlan === '1')
		this.fromResult = !!(query && query.fromResult === '1')
		this.planSourceId = query?.planId ? decodeURIComponent(query.planId) : ''
		this.planSourceDate = query?.planDate ? decodeURIComponent(query.planDate) : ''
		this.planReturnSource = query?.planReturnSource === 'profile' ? 'profile' : ''
		const queryName = query?.name ? decodeURIComponent(query.name) : ''
		const cached = uni.getStorageSync('latestRecipeDetail')
		const cacheMatchesQuery = !queryName || this.normalizeName(cached?.name) === this.normalizeName(queryName)
		if (cached && typeof cached === 'object' && (!this.fromFavorite || cacheMatchesQuery)) this.applyRecipeFromRaw(cached)
		if (queryName) this.recipe.name = queryName
		this.favoriteSyncing = this.fromFavorite
		this.syncFavoriteState(this.fromFavorite)
		this.ensureRecipeDetail()
	},
	onShow() {
		this.ensureShareMenu()
		this.loadPantryNames()
		this.refreshFavoriteFromServer()
	},
	onUnload() {
		this.detailRequestId += 1
		if (this.nutritionRevealTimer) clearTimeout(this.nutritionRevealTimer)
		if (this.recipeAudioContext) {
			this.recipeAudioContext.stop()
			this.recipeAudioContext.destroy()
		}
	},
	onShareAppMessage() {
		const name = `${this.recipe?.name || ''}`.trim() || '家常菜'
		return {
			title: `这道 ${name} 看起来不错，分享给你`,
			path: `/pages/recipe/detail?name=${encodeURIComponent(name)}`
		}
	},
	onShareTimeline() {
		const name = `${this.recipe?.name || ''}`.trim() || '家常菜'
		return {
			title: `鲜食档案菜谱：${name}`
		}
	},
	methods: {
		formatLocalDate(date) {
			const pad = (n) => `${n}`.padStart(2, '0')
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
		},
		openPlanModal() {
			const today = new Date()
			this.planDate = this.formatLocalDate(today)
			this.planMeal = 'dinner'
			this.planModalVisible = true
		},
		closePlanModal() { this.planModalVisible = false },
		async confirmAddPlan() {
			const added = addMealPlan({
				date: this.planDate,
				meal: this.planMeal,
				servings: Math.max(1, Number(this.recipe.servings || 1)),
				recipeName: this.recipe.name,
				duration: this.recipe.duration,
				difficulty: this.recipe.difficulty,
				recipe: this.recipe.raw || null
			})
			if (!added) { uni.showToast({ title: '加入失败，请重试', icon: 'none' }); return }
			try { await saveMealPlanToServer({ ...added, clientId: `${added.id}` }) } catch (_) {}
			this.planModalVisible = false
			uni.showModal({
				title: '已加入计划',
				content: `${this.planDateText} · ${this.planMealOptions.find((item) => item.value === this.planMeal)?.label || ''}`,
				confirmText: '查看计划',
				cancelText: '继续浏览',
				success: (res) => { if (res.confirm) uni.redirectTo({ url: `/pages/recipe/generate?tab=plan&date=${this.planDate}` }) }
			})
		},
		copyVideoSearchKeyword() {
			const name = `${this.recipe?.name || ''}`.trim()
			if (!name) {
				uni.showToast({ title: '暂未获取到菜谱名称', icon: 'none' })
				return
			}
			const keyword = `${name} 做法`
			uni.setClipboardData({
				data: keyword,
				success: () => uni.showToast({ title: '已复制，去视频平台搜索', icon: 'none' }),
				fail: () => uni.showToast({ title: '复制失败，请重试', icon: 'none' })
			})
		},
		initRecipeAudio() {
			if (typeof uni.createInnerAudioContext !== 'function') return
			configureSpeechAudio()
			const audio = uni.createInnerAudioContext()
			audio.autoplay = false
			audio.volume = 1
			audio.obeyMuteSwitch = false
			audio.onPlay(() => {
				this.recipeAudioPlaybackStarted = true
				this.isRecipeSpeaking = true
			})
			audio.onEnded(() => {
				this.recipeAudioPlaybackStarted = false
				this.isRecipeSpeaking = false
			})
			audio.onStop(() => {
				this.recipeAudioPlaybackStarted = false
				this.isRecipeSpeaking = false
			})
			audio.onError((error) => {
				console.error('菜谱播放失败', error)
				const started = this.recipeAudioPlaybackStarted || this.isRecipeSpeaking
				this.recipeAudioPlaybackStarted = false
				this.isRecipeSpeaking = false
				this.isRecipeSynthesizing = false
				if (!started) uni.showToast({ title: '菜谱朗读失败，请重试', icon: 'none' })
			})
			this.recipeAudioContext = audio
		},
		buildRecipeSpeechText() {
			const steps = (Array.isArray(this.recipe?.steps) ? this.recipe.steps : [])
				.map((step, index) => `第${index + 1}步，${this.formatStepText(step)}`)
			return [
				`${this.recipe?.name || '这道菜'}。`,
				`所需食材，${this.recipe?.ingredientsText || ''}。`,
				...steps
			].filter(Boolean).join('').slice(0, 600)
		},
		async toggleRecipeSpeech() {
			if (this.isRecipeSynthesizing) return
			if (this.isRecipeSpeaking && this.recipeAudioContext) {
				this.recipeAudioContext.stop()
				return
			}
			if (!this.recipeAudioContext) {
				uni.showToast({ title: '当前环境不支持语音播放', icon: 'none' })
				return
			}
			const text = this.buildRecipeSpeechText()
			if (!text || !this.hasRecipeDetail) return
			this.recipeAudioPlaybackStarted = false
			this.isRecipeSynthesizing = true
			try {
				const res = await synthesizeAssistantSpeech(text)
				const audioPath = `${res?.data?.audioPath || res?.audioPath || ''}`.trim()
				if (!audioPath) throw new Error('没有生成朗读音频')
				await playSpeechAudio(this.recipeAudioContext, audioPath)
			} catch (error) {
				console.error('菜谱朗读失败', error)
				uni.showToast({ title: `${error?.message || '菜谱朗读失败，请重试'}`, icon: 'none' })
			} finally {
				this.isRecipeSynthesizing = false
			}
		},
		formatIngredientItems(items) {
			return (Array.isArray(items) ? items : [])
				.map((item) => `${item?.name || ''}${item?.amount || ''}`.trim())
				.filter(Boolean)
				.join('、')
		},
		async loadPantryNames() {
			this.pantryLoadState = 'loading'
			try {
				const res = await getIngredientList()
				const items = this.unwrapListPayload(res)
				const names = items.map((item) => `${item?.name || ''}`.trim()).filter(Boolean)
				this.pantryItems = items
				this.pantryNames = names
				this.pantryLoadState = 'ready'
				return
			} catch (_) {}
			const storedIngredients = uni.getStorageSync('latestPantryIngredients')
			const storedTags = uni.getStorageSync('latestPantryTags')
			this.pantryItems = []
			this.pantryNames = Array.isArray(storedIngredients) && storedIngredients.length
				? storedIngredients.map((item) => `${item?.name || ''}`.trim()).filter(Boolean)
				: (Array.isArray(storedTags) ? storedTags.map((name) => `${name || ''}`.trim()).filter(Boolean) : [])
			this.pantryLoadState = this.pantryNames.length ? 'fallback' : 'error'
		},
		formatNutritionValue(value) {
			const number = Number(value || 0)
			if (!Number.isFinite(number)) return '0'
			return Number.isInteger(number) ? `${number}` : `${Math.round(number * 10) / 10}`
		},
		detailCacheKey(recipe = this.recipe) {
			const name = this.normalizeName(recipe?.name)
			return name ? `${RECIPE_DETAIL_CACHE_PREFIX}${name}` : ''
		},
		readDetailCache() {
			const key = this.detailCacheKey()
			if (!key) return null
			try {
				const cached = uni.getStorageSync(key)
				return cached && typeof cached === 'object' ? cached : null
			} catch (_) {
				return null
			}
		},
		writeDetailCache(recipe) {
			const key = this.detailCacheKey(recipe)
			if (!key || !recipe || typeof recipe !== 'object') return
			try {
				uni.setStorageSync(key, recipe)
			} catch (_) {}
		},
		isDetailComplete(recipe) {
			const nutrition = recipe?.nutrition
			const steps = Array.isArray(recipe?.steps) ? recipe.steps.map((step) => `${step || ''}`.trim()).filter(Boolean) : []
			const forbiddenStep = /本步骤操作要求|完成后进入下一步|详情内容不完整|按菜式需要|准备并清洗所有食材|二选一|如何判断|方法[一二三四]|\*\*|\bshimmer\b|\b\d+\s*s\b/iu
			const nutritionValues = nutrition
				? [nutrition.calories, nutrition.protein, nutrition.fat, nutrition.carbohydrates, nutrition.fiber, nutrition.sodium]
				: []
			return !!recipe &&
				steps.length >= 3 && steps.length <= 14 &&
				!steps.some((step) => forbiddenStep.test(step) || step.length < 10) &&
				Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 &&
				nutritionValues.length === 6 &&
				nutritionValues.every((value) => Number.isFinite(Number(value)) && Number(value) >= 0) &&
				Number(nutrition?.calories) > 0 && !!`${nutrition?.analysis || ''}`.trim()
		},
		isStepsComplete(recipe) {
			const steps = Array.isArray(recipe?.steps) ? recipe.steps.map((step) => `${step || ''}`.trim()).filter(Boolean) : []
			const forbiddenStep = /本步骤操作要求|完成后进入下一步|详情内容不完整|按菜式需要|准备并清洗所有食材|二选一|如何判断|方法[一二三四]|\*\*|\bshimmer\b|\b\d+\s*s\b/iu
			return !!recipe &&
				Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 &&
				steps.length >= 3 && steps.length <= 14 &&
				!steps.some((step) => forbiddenStep.test(step) || step.length < 10)
		},
		isNutritionComplete(nutrition) {
			const values = nutrition
				? [nutrition.calories, nutrition.protein, nutrition.fat, nutrition.carbohydrates, nutrition.fiber, nutrition.sodium]
				: []
			return values.length === 6 &&
				values.every((value) => Number.isFinite(Number(value)) && Number(value) >= 0) &&
				Number(nutrition?.calories) > 0 && !!`${nutrition?.analysis || ''}`.trim()
		},
		async ensureRecipeDetail(force = false) {
			const currentContractVersion = Number(this.recipe?.raw?.ingredientSetVersion || 1)
			if (this.fromFavorite && this.hasRecipeDetail && currentContractVersion >= 2) {
				this.stepsLoading = false
				this.nutritionLoading = false
				this.stepsError = ''
				this.nutritionError = ''
				return
			}
			if ((this.stepsLoading || this.nutritionLoading) && !force) return
			if (!force) {
				const cached = this.readDetailCache()
				if (this.isDetailComplete(cached)) {
					this.applyRecipeFromRaw(cached)
					uni.setStorageSync('latestRecipeDetail', cached)
					return
				}
				if (this.isDetailComplete(this.recipe?.raw) && Number(this.recipe?.raw?.detailQualityVersion) === RECIPE_DETAIL_QUALITY_VERSION) return
			}
			const summary = this.recipe?.raw && typeof this.recipe.raw === 'object'
				? this.recipe.raw
				: {
					name: this.recipe.name,
					duration: this.recipe.duration,
					difficulty: this.recipe.difficulty,
					servings: this.recipe.servings,
					ingredients: this.pickRecipeIngredientItems()
				}
			if ((this.hasRecipeDetail || this.hasNutrition) && !this.fromFavorite) {
				this.applyRecipeFromRaw({
					...summary,
					steps: [],
					nutrition: null
				})
			}
			this.stepsLoading = true
			this.nutritionLoading = true
			this.stepsError = ''
			this.nutritionError = ''
			this.pendingNutrition = null
			if (this.nutritionRevealTimer) clearTimeout(this.nutritionRevealTimer)
			const requestId = ++this.detailRequestId
			let stepsFailed = false
			let nutritionFailed = false

			const stepsRequest = getRecipeSteps({ recipe: summary })
				.then((res) => {
					if (requestId !== this.detailRequestId) return
					const detail = res?.data?.recipe || res?.recipe
					if (!this.isStepsComplete(detail)) throw new Error('菜谱步骤生成失败，请重试')
					const detailIngredients = Array.isArray(detail?.ingredients) ? detail.ingredients : []
					const summaryIngredients = Array.isArray(summary?.ingredients) ? summary.ingredients : []
					const resolved = {
						...(detail || {}),
						ingredients: detailIngredients.length ? detailIngredients : summaryIngredients,
						nutrition: null
					}
					this.applyRecipeFromRaw(resolved)
					if (this.fromFavorite && resolved.contractUpgraded) {
						const payload = {
							name: resolved.name || this.recipe.name,
							duration: Number(resolved.duration || this.recipe.duration || 0),
							difficulty: resolved.difficulty || this.recipe.difficulty,
							raw: resolved,
							completedCount: this.completedCount,
							lastCompletedAt: this.lastCompletedAt || null
						}
						saveFavoriteToServer(payload).then(() => this.syncFavoriteState(true)).catch(() => {})
					}
					return resolved
				})
				.catch((error) => {
					if (requestId !== this.detailRequestId) return
					console.warn('菜谱步骤生成失败', error)
					stepsFailed = true
				})
				.finally(() => {
					if (requestId !== this.detailRequestId) return
					this.stepsLoading = false
				})

			const nutritionRequest = stepsRequest
				.then(async (resolved) => {
					if (!resolved || requestId !== this.detailRequestId) return
					const res = await getRecipeNutrition({ recipe: resolved })
					if (requestId !== this.detailRequestId) return
					const nutrition = res?.data?.nutrition || res?.nutrition
					if (!this.isNutritionComplete(nutrition)) throw new Error('营养数据生成失败，请重试')
					this.pendingNutrition = nutrition
					this.revealPendingNutrition()
				})
				.catch((error) => {
					if (requestId !== this.detailRequestId) return
					console.warn('营养数据生成失败', error)
					nutritionFailed = true
					this.nutritionLoading = false
				})

			await Promise.allSettled([stepsRequest, nutritionRequest])
			if (requestId !== this.detailRequestId) return
			if (stepsFailed || nutritionFailed) {
				this.stepsLoading = false
				this.nutritionLoading = false
				if (stepsFailed) this.stepsError = '这份菜谱暂时无法完成生成，请稍后再查看'
				if (nutritionFailed && this.hasRecipeDetail) this.nutritionError = '营养信息暂时无法完成生成，请稍后再查看'
				return
			}
		},
		revealPendingNutrition() {
			if (!this.hasRecipeDetail || !this.pendingNutrition || !this.isNutritionComplete(this.pendingNutrition)) return
			if (this.nutritionRevealTimer) clearTimeout(this.nutritionRevealTimer)
			const requestId = this.detailRequestId
			this.nutritionRevealTimer = setTimeout(() => {
				if (requestId !== this.detailRequestId) return
				const completed = {
					...(this.recipe?.raw || {}),
					nutrition: this.pendingNutrition,
					detailQualityVersion: RECIPE_DETAIL_QUALITY_VERSION
				}
				this.pendingNutrition = null
				this.nutritionLoading = false
				this.applyRecipeFromRaw(completed)
				if (this.isDetailComplete(completed)) {
					this.writeDetailCache(completed)
					uni.setStorageSync('latestRecipeDetail', completed)
					if (this.fromFavorite && completed.contractUpgraded) {
						const payload = {
							name: completed.name || this.recipe.name,
							duration: Number(completed.duration || this.recipe.duration || 0),
							difficulty: completed.difficulty || this.recipe.difficulty,
							raw: completed,
							completedCount: this.completedCount,
							lastCompletedAt: this.lastCompletedAt || null
						}
						saveFavoriteToServer(payload).then(() => this.syncFavoriteState(true)).catch(() => {})
					}
				}
			}, 180)
		},
		ensureShareMenu() {
			if (typeof uni === 'undefined' || typeof uni.showShareMenu !== 'function') return
			try {
				uni.showShareMenu({
					menus: ['shareAppMessage', 'shareTimeline']
				})
			} catch (_) {}
		},
		applyRecipeFromRaw(raw) {
			const ingredientText = Array.isArray(raw?.ingredients)
				? raw.ingredients.map((x) => `${x?.name || ''}${x?.quantity ?? ''}${x?.unit || ''}`.trim()).filter(Boolean).join('、')
				: ''
			const stepList = Array.isArray(raw?.steps)
				? raw.steps.map((x) => typeof x === 'string' ? x : `${x?.description || x?.title || ''}`).map((x) => x.trim()).filter(Boolean)
				: []
			this.recipe = {
				...this.recipe,
				name: raw?.name || this.recipe.name,
				duration: Number(raw?.duration || this.recipe.duration),
				difficulty: raw?.difficulty || this.recipe.difficulty,
				servings: Math.max(1, Number(raw?.servings || this.recipe.servings || 2)),
				ingredientsText: ingredientText || this.recipe.ingredientsText,
				ingredients: ingredientText ? ingredientText.split('、') : this.recipe.ingredients,
				steps: stepList,
				nutrition: raw?.nutrition && typeof raw.nutrition === 'object' ? raw.nutrition : null,
				raw
			}
		},
		formatStepText(step) {
			return `${step || ''}`
				.replace(/^\s*\d+\s*[\.、:：)\]]\s*/, '')
				.replace(/\bshimmer\b/gi, '微微发亮')
				.trim()
		},
		syncFavoriteState(preferFavoriteData = false) {
			const fav = getFavoriteRecipeByName(this.recipe.name)
			if (!fav) return
			this.favorited = true
			this.completedCount = Number(fav.completedCount || 0)
			this.lastCompletedAt = fav.lastCompletedAt || ''
			if (!preferFavoriteData) return
			if (fav.raw && typeof fav.raw === 'object') {
				this.applyRecipeFromRaw(fav.raw)
				return
			}
			const text = [...(fav.available || []), ...(fav.missing || [])].filter(Boolean).join('、')
			this.recipe = {
				...this.recipe,
				duration: Number(fav.duration || this.recipe.duration),
				difficulty: fav.difficulty || this.recipe.difficulty,
				ingredientsText: text || this.recipe.ingredientsText
			}
		},
		async favorite() {
			if (this.favorited) {
				uni.showToast({ title: '已在收藏中', icon: 'none' })
				return
			}
			const payload = {
				name: this.recipe.name,
				available: this.recipe.ingredients.slice(0, 2),
				missing: [],
				duration: this.recipe.duration,
				difficulty: this.recipe.difficulty,
				raw: this.recipe.raw || null
			}
			const ok = addFavoriteRecipe(payload)
			if (!ok) {
				this.favorited = true
				uni.showToast({ title: '已在收藏中', icon: 'none' })
				return
			}
			this.favorited = true
			this.syncFavoriteState()
			try {
				const synced = await saveFavoriteToServer(payload)
				if (synced) this.syncFavoriteState()
			} catch (_) {}
			uni.showToast({ title: '已加入收藏', icon: 'success' })
		},
		async refreshFavoriteFromServer() {
			try {
				await syncFavoriteRecipes()
				this.favorited = false
				this.completedCount = 0
				this.lastCompletedAt = ''
				this.syncFavoriteState(this.fromFavorite)
			} catch (_) {
				this.syncFavoriteState(this.fromFavorite)
			} finally {
				this.favoriteSyncing = false
			}
		},
		canonicalIngredientName(text) {
			const name = this.normalizeName(text)
			const aliases = {
				西红柿: '番茄',
				马铃薯: '土豆',
				洋芋: '土豆',
				生抽: '酱油',
				植物油: '食用油',
				烹调油: '食用油'
			}
			return aliases[name] || name
		},
		isIngredientAvailableNow(recipeItem, pantryItems = this.pantryItems, fallbackNames = this.pantryNames) {
			const recipeName = this.canonicalIngredientName(recipeItem?.name)
			if (!recipeName) return false
			const pantry = Array.isArray(pantryItems) ? pantryItems : []
			const matches = pantry.filter((item) =>
				Number(item?.quantity) > 0 && this.canonicalIngredientName(item?.name) === recipeName
			)
			if (!matches.length) {
				return (Array.isArray(fallbackNames) ? fallbackNames : [])
					.some((name) => this.canonicalIngredientName(name) === recipeName)
			}
			const requestedQuantity = Number(recipeItem?.quantity)
			const requestedUnit = this.normalizeIngredientUnit(recipeItem?.unit)
			if (!Number.isFinite(requestedQuantity) || requestedQuantity <= 0 || !requestedUnit || requestedUnit === '份' || requestedUnit === '适量') {
				return true
			}
			const compatible = matches.filter((item) => this.normalizeIngredientUnit(item?.unit) === requestedUnit)
			if (!compatible.length) return true
			const currentQuantity = compatible.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
			return currentQuantity >= requestedQuantity
		},
		isCondimentIngredient(item) {
			const category = `${item?.category || ''}`.trim()
			if (category === '调味品' || category === '调料') return true
			const name = `${item?.name || ''}`.trim()
			return /(食用油|植物油|橄榄油|花生油|菜籽油|芝麻油|香油|盐|白糖|红糖|冰糖|酱油|生抽|老抽|蚝油|料酒|醋|胡椒|花椒|辣椒粉|辣椒面|孜然|鸡精|味精|十三香|咖喱粉|淀粉|蜂蜜|番茄酱|豆瓣酱|沙拉酱|芝麻酱)/.test(name)
		},
		normalizeIngredientUnit(unit) {
			const value = `${unit || ''}`.trim().toLowerCase()
			const aliases = {
				克: 'g',
				千克: 'kg',
				公斤: 'kg',
				毫升: 'ml',
				升: 'l',
				枚: '个',
				只: '个'
			}
			return aliases[value] || value
		},
		formatPlainNumber(value) {
			const number = Number(value || 0)
			if (!Number.isFinite(number)) return '0'
			return Number.isInteger(number) ? `${number}` : `${Math.round(number * 100) / 100}`
		},
		buildCompletionItems(pantryItems) {
			const pantry = (Array.isArray(pantryItems) ? pantryItems : [])
				.filter((item) => Number.isInteger(Number(item?.id)) && Number(item?.quantity) > 0)
			const matchedIds = new Set()
			const matched = []
			const unmatched = []
			for (const recipeItem of this.pickRecipeIngredientItems()) {
				if (this.isCondimentIngredient(recipeItem)) continue
				const recipeName = this.canonicalIngredientName(recipeItem.name)
				const recipeUnit = this.normalizeIngredientUnit(recipeItem.unit)
				const candidates = pantry.filter((item) => !matchedIds.has(item.id) && this.canonicalIngredientName(item.name) === recipeName)
				const pantryItem = candidates.find((item) => !!recipeUnit && this.normalizeIngredientUnit(item.unit) === recipeUnit)
				if (!pantryItem) {
					unmatched.push(recipeItem.name)
					continue
				}
				if (this.isCondimentIngredient(pantryItem)) continue
				matchedIds.add(pantryItem.id)
				const stock = Number(pantryItem.quantity || 0)
				const requested = Number(recipeItem.quantity || 1)
				const initial = Math.min(stock, requested > 0 ? requested : 1)
				matched.push({
					id: Number(pantryItem.id),
					name: `${pantryItem.name || recipeItem.name}`.trim(),
					unit: `${pantryItem.unit || ''}`.trim(),
					stock,
					quantity: this.formatPlainNumber(initial)
				})
			}
			this.completionUnmatchedNames = [...new Set(unmatched.filter(Boolean))]
			return matched
		},
		async openCompletionModal() {
			if (this.completionSubmitting || this.completionDone) return
			try {
				uni.showLoading({ title: '正在核对库存' })
				const res = await getIngredientList()
				const items = this.unwrapListPayload(res)
				this.pantryItems = items
				this.pantryNames = items.map((item) => `${item?.name || ''}`.trim()).filter(Boolean)
				this.pantryLoadState = 'ready'
				this.completionItems = this.buildCompletionItems(items)
				this.completionModalVisible = true
			} catch (error) {
				uni.showToast({ title: `${error?.message || '暂时无法读取冰箱库存'}`, icon: 'none' })
			} finally {
				uni.hideLoading()
			}
		},
		closeCompletionModal() {
			if (this.completionSubmitting) return
			this.completionModalVisible = false
		},
		adjustCompletionQuantity(index, delta) {
			const current = this.completionItems[index]
			if (!current) return
			const next = Math.min(current.stock, Math.max(0.01, Number(current.quantity || 0) + Number(delta || 0)))
			this.completionItems.splice(index, 1, { ...current, quantity: this.formatPlainNumber(next) })
		},
		onCompletionQuantityInput(index, event) {
			const current = this.completionItems[index]
			if (!current) return
			const raw = Number(event?.detail?.value || 0)
			const next = Number.isFinite(raw) ? Math.min(current.stock, Math.max(0, raw)) : 0
			this.completionItems.splice(index, 1, { ...current, quantity: `${next || ''}` })
		},
		async confirmCompletion() {
			if (this.completionSubmitting) return
			const payload = this.completionItems
				.filter((item) => Number(item.quantity) > 0)
				.map((item) => ({ id: item.id, quantity: Number(item.quantity) }))
			this.completionSubmitting = true
			let inventoryUpdated = !payload.length
			try {
				// 完成状态是用户行为记录，不应被库存扣减结果阻断。
				this.completionDone = true
				this.completionModalVisible = false
				if (this.favorited) {
					const updated = markFavoriteRecipeCompleted(this.recipe.name)
					if (updated) {
						this.completedCount = Number(updated.completedCount || 0)
						this.lastCompletedAt = updated.lastCompletedAt || ''
					}
					try {
						const synced = await completeFavoriteOnServer(this.recipe.name)
						if (synced) {
							this.completedCount = Number(synced.completedCount || 0)
							this.lastCompletedAt = synced.lastCompletedAt || ''
						}
					} catch (_) {}
				}
				if (this.fromPlan && this.planSourceId) {
					markMealPlanCompleted(this.planSourceId)
					try { await completeMealPlanOnServer(this.planSourceId) } catch (_) {}
				}
				if (payload.length) {
					try {
						await consumeIngredientsBatch(payload)
						inventoryUpdated = true
						await this.loadPantryNames()
					} catch (error) {
						console.warn('制作已完成，但库存扣减失败', error)
					}
				}
				uni.showToast({
					title: !payload.length ? '已标记制作完成' : (inventoryUpdated ? '制作完成，库存已更新' : '已标记完成，库存更新失败'),
					icon: inventoryUpdated ? 'success' : 'none'
				})
			} catch (error) {
				this.completionDone = true
				this.completionModalVisible = false
				console.warn('完成记录同步失败', error)
				uni.showToast({ title: '已标记完成，同步稍后重试', icon: 'none' })
			} finally {
				this.completionSubmitting = false
			}
		},
		unfavorite() {
			if (!this.favorited) {
				uni.showToast({ title: '当前未收藏', icon: 'none' })
				return
			}
			uni.showModal({
				title: '取消收藏',
				content: '确认取消收藏该菜谱吗？',
				success: async (res) => {
					if (!res.confirm) return
					const ok = removeFavoriteRecipe(this.recipe.name)
					if (!ok) {
						uni.showToast({ title: '取消失败，请重试', icon: 'none' })
						return
					}
					this.favorited = false
					this.completedCount = 0
					this.lastCompletedAt = ''
					try { await deleteFavoriteFromServer(this.recipe.name) } catch (_) {}
					uni.showToast({ title: '已取消收藏', icon: 'success' })
					if (this.fromFavorite) {
						setTimeout(() => {
							this.backToResult()
						}, 220)
					}
				}
			})
		},
		formatDateTime(time) {
			if (!time) return ''
			const date = new Date(time)
			if (Number.isFinite(date.getTime())) {
				const pad = (n) => `${n}`.padStart(2, '0')
				return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
			}
			const text = `${time}`
			if (text.includes('T')) return text.replace('T', ' ').slice(0, 16)
			return text.slice(0, 16)
		},
		normalizeName(text) {
			return `${text || ''}`
				.trim()
				.toLowerCase()
				.replace(/[（(].*?[）)]/g, '')
				.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
		},
		pickRecipeIngredientItems() {
			const fromRaw = Array.isArray(this.recipe?.raw?.ingredients)
				? this.recipe.raw.ingredients.map((x) => ({
						name: `${x?.name || ''}`.trim(),
						quantity: Number(x?.quantity || 1),
						unit: `${x?.unit || ''}`.trim() || '份',
						category: `${x?.category || ''}`.trim()
					})).filter((x) => !!x.name)
				: []
			if (fromRaw.length) return fromRaw
			return `${this.recipe?.ingredientsText || ''}`.split('、').map((s) => `${s || ''}`.trim()).filter(Boolean)
				.map((s) => ({ name: s.replace(/\d+.*$/, '').trim(), quantity: 1, unit: '份', category: '' })).filter((x) => !!x.name)
		},
		unwrapListPayload(source) {
			if (Array.isArray(source)) return source
			if (source && Array.isArray(source.data)) return source.data
			if (source && source.data && Array.isArray(source.data.data)) return source.data.data
			return []
		},
		async addMissingToBasket() {
			const recipeItems = this.pickRecipeIngredientItems()
			if (!recipeItems.length) {
				uni.showToast({ title: '暂无可加入的食材', icon: 'none' })
				return
			}
			let pantryList = []
			try {
				const res = await getIngredientList()
				pantryList = this.unwrapListPayload(res)
			} catch (e) {
				pantryList = []
			}
			if (!pantryList.length) {
				const tags = uni.getStorageSync('latestPantryTags')
				pantryList = Array.isArray(tags) ? tags.map((name) => ({ name })) : []
			}
			const missing = recipeItems.filter((item) => !this.isIngredientAvailableNow(item, pantryList, []))
			if (!missing.length) {
				uni.showToast({ title: '当前食材充足，无需加入', icon: 'none' })
				return
			}
			let result = { added: 0, merged: 0 }
			const payload = missing.map((x) => toSmartBasketItem(x))
			try {
				result = await upsertBasketItemsApi(payload, this.recipe.name, 1, 'max')
			} catch (e) {
				// Fallback keeps legacy local flow if backend is unavailable.
				result = upsertBasketItemsLocal(payload, this.recipe.name, 'max')
			}
			uni.showToast({ title: '已加入菜篮子', icon: 'success' })
		},
		backToResult() {
			const pages = getCurrentPages()
			const previous = Array.isArray(pages) && pages.length > 1 ? pages[pages.length - 2] : null
			const previousRoute = `${previous?.route || ''}`.replace(/^\//, '')
			const openWithRedirect = (url) => {
				uni.redirectTo({
					url,
					fail: () => {
						uni.reLaunch({ url })
					}
				})
			}
			if (this.fromFavorite) {
				if (previousRoute === 'pages/profile/favorites') {
					uni.navigateBack()
					return
				}
				openWithRedirect('/pages/profile/favorites')
				return
			}
			if (this.fromPlan) {
				if (previousRoute === 'pages/recipe/generate') {
					uni.navigateBack()
					return
				}
				const dateQuery = this.planSourceDate ? `&date=${encodeURIComponent(this.planSourceDate)}` : ''
				const sourceQuery = this.planReturnSource === 'profile' ? '&from=profile' : ''
				openWithRedirect(`/pages/recipe/generate?tab=plan${dateQuery}${sourceQuery}`)
				return
			}
			if (this.fromResult) {
				if (previousRoute === 'pages/recipe/result') {
					uni.navigateBack()
					return
				}
				openWithRedirect('/pages/recipe/result')
				return
			}
			if (Array.isArray(pages) && pages.length > 1) {
				uni.navigateBack()
				return
			}
			openWithRedirect('/pages/recipe/result')
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
		}
	}
}
</script>

<style scoped>
.container { padding: 10px 12px 96px; }
.top { display: flex; align-items: center; gap: 10rpx; margin-bottom: 20rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.back-left { width: 30px; height: 30px; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; }
.back-arrow { font-size: 30px; line-height: 1; color: #c7ced9; transform: translateY(-1px); }
.recipe-inner { margin-bottom: 14rpx; }
.head { display: grid; grid-template-columns: 58px 1fr auto; column-gap: 12px; row-gap: 8rpx; align-items: center; margin-bottom: 14rpx; padding: 18rpx; background: #fff; border: 1rpx solid #edf2ee; border-radius: 18px; box-shadow: 0 8rpx 22rpx rgba(39,76,45,.055); }
.head-main { min-width: 0; }
.recipe-avatar { width: 58px; height: 58px; border-radius: 16px; display: flex; align-items: center; justify-content: center; background: linear-gradient(145deg,#edf8ef,#f9fcf9); border: 1rpx solid #dfede2; }
.head-unfavorite-btn { height: 30px; line-height: 30px; padding: 0 10px; border-radius: 999rpx; font-size: 12px; color: #6a6f6b; background: #f3f3f3; border: 1rpx solid #e4e7e5; box-shadow: none; }
.head-unfavorite-btn::after { border: none; }
.favorite-wrap { margin-bottom: 8rpx; }
.action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10rpx; }
.complete-meta { display: block; font-size: 11px; color: #7f8c83; margin-top: 8rpx; padding-left: 4rpx; }
.title-video-link { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 9rpx; max-width: 100%; }
.title-video-link-active { opacity: .62; }
.title { display: inline; max-width: 100%; padding-bottom: 2rpx; border-bottom: 1rpx dashed #aebbb1; color: #1f2922; font-size: 18px; font-weight: 800; line-height: 1.35; overflow: visible; white-space: normal; word-break: break-all; }
.video-play-icon { position: relative; width: 30rpx; height: 30rpx; flex-shrink: 0; border: 2rpx solid #929b95; border-radius: 50%; }
.video-play-icon::after { content: ''; position: absolute; left: 11rpx; top: 8rpx; width: 0; height: 0; border-top: 6rpx solid transparent; border-bottom: 6rpx solid transparent; border-left: 9rpx solid #929b95; }
.meta { display: block; margin-top: 5rpx; font-size: 12px; color: #738177; }
.recipe-banner { border-radius: 18px; padding: 18rpx; background: #fff; border: 1rpx solid #edf2ee; box-shadow: 0 8rpx 22rpx rgba(39,76,45,.045); margin-bottom: 14rpx; }
.banner-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14rpx; }
.banner-title { font-weight: 800; font-size: 15px; color: #202a22; }
.banner-count { color: #8a958d; font-size: 10px; }
.banner-count.missing { color: #c37a3d; font-weight: 600; }
.ingredient-group { display: grid; grid-template-columns: 98rpx 1fr; column-gap: 12rpx; align-items: start; padding: 9rpx 0 15rpx; }
.ingredient-group + .ingredient-group { margin-top: 5rpx; padding-top: 18rpx; border-top: 1rpx solid #eef2ef; }
.ingredient-group-label { display: inline-flex; align-items: center; justify-content: center; min-height: 38rpx; padding: 0 8rpx; border-radius: 8px; background: #edf6ef; color: #4f8f59; font-size: 9px; font-weight: 700; }
.ingredient-group-text { color: #59665d; font-size: 11px; line-height: 1.75; }
.ingredient-group.missing .ingredient-group-label { background: #fff2e5; color: #bd7133; }
.ingredient-group.missing .ingredient-group-text { color: #a96732; }
.ingredient-group.missing { grid-template-columns: 98rpx minmax(0,1fr) auto; align-items: center; padding-bottom: 9rpx; }
.ingredient-group.missing .ingredient-group-text { min-width: 0; }
.ingredient-basket-btn { display: inline-flex; align-items: center; justify-content: center; gap: 5rpx; height: 48rpx; margin: 0; padding: 0 14rpx; border: 1rpx solid #d8e8da; border-radius: 999rpx; color: #4e9658; background: #f1f8f2; font-size: 9px; font-weight: 700; line-height: 1; box-shadow: none; white-space: nowrap; }
.ingredient-basket-btn .basket-action-icon { font-size: 14px; }
.ingredient-basket-btn::after { border: none; }
.ingredient-status-text { display: block; padding: 6rpx 0 10rpx; color: #8a958d; font-size: 11px; }
.ingredient-status-text.error { color: #a7785b; }
.detail-loading-card,
.detail-error-card { display: flex; align-items: center; gap: 14rpx; border: 1rpx solid #e6eee8; border-radius: 14px; padding: 20rpx 16rpx; background: #f8fbf8; margin-bottom: 12rpx; }
.detail-loading-dot { width: 24rpx; height: 24rpx; border-radius: 50%; border: 4rpx solid #dcecdf; border-top-color: #55ad61; animation: detail-spin .8s linear infinite; flex-shrink: 0; }
.detail-loading-title { display: block; color: #42684a; font-size: 13px; font-weight: 700; }
.detail-loading-meta { display: block; color: #839087; font-size: 11px; margin-top: 5rpx; }
.detail-error-card { justify-content: space-between; background: #fff9f5; border-color: #f2e3d7; }
.detail-error-text { flex: 1; color: #9a6a4a; font-size: 12px; line-height: 1.5; }
.detail-retry-btn { margin: 0; padding: 0 16rpx; height: 54rpx; line-height: 54rpx; border-radius: 999rpx; background: #edf6ef; color: #4c9657; font-size: 11px; font-weight: 700; }
.detail-retry-btn::after { border: none; }
@keyframes detail-spin { to { transform: rotate(360deg); } }
.step-card { border: 1rpx solid #edf2ee; border-radius: 18px; padding: 18rpx; background: #fff; margin-bottom: 14rpx; box-shadow: 0 8rpx 22rpx rgba(39,76,45,.045); }
.step-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18rpx; }
.step-title { font-weight: 800; font-size: 15px; color: #202a22; }
.step-meta { color: #8a958d; font-size: 10px; }
.step-head-actions { display: flex; align-items: center; gap: 10rpx; }
.read-step-btn { padding: 7rpx 12rpx; border-radius: 999rpx; color: #527db3; background: #edf4fc; font-size: 9px; font-weight: 700; }
.step-list { padding-top: 2rpx; }
.step-line { display: block; color: #536058; line-height: 1.72; font-size: 12px; }
.step-item { position: relative; min-height: 54rpx; padding: 0 0 22rpx 44rpx; }
.step-item:not(:last-child)::after { content: ''; position: absolute; left: 14rpx; top: 34rpx; bottom: 3rpx; width: 1rpx; background: #dfece1; }
.step-item:last-child { padding-bottom: 0; }
.step-no {
	position: absolute;
	left: 0;
	top: 0;
	width: 30rpx;
	height: 30rpx;
	border-radius: 50%;
	background: #e5f4e8;
	color: #489554;
	font-size: 10px;
	font-weight: 800;
	display: inline-flex;
	align-items: center;
	justify-content: center;
}
.nutrition-card { border: 1rpx solid #e4ece5; border-radius: 18px; padding: 18rpx 16rpx 14rpx; background: #fff; margin-bottom: 14rpx; box-shadow: 0 8rpx 22rpx rgba(39,76,45,.045); }
.nutrition-head { display: flex; align-items: baseline; gap: 8rpx; margin-bottom: 14rpx; }
.nutrition-title { font-size: 15px; font-weight: 800; color: #202820; }
.nutrition-serving { font-size: 10px; color: #89938c; }
.nutrition-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 5rpx; }
.nutrition-item { min-width: 0; min-height: 112rpx; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 16rpx 2rpx 15rpx; border-radius: 10px; background: #f6f9f6; border: 1rpx solid #eef3ef; }
.nutrition-icon { height: 32rpx; line-height: 32rpx; font-size: 15px; color: #55a765; font-weight: 800; }
.nutrition-label { width: 100%; margin-top: 4rpx; color: #68736b; font-size: 9px; line-height: 1.25; text-align: center; white-space: nowrap; transform: scale(.92); }
.nutrition-value { margin-top: 8rpx; color: #1e2620; font-size: 15px; font-weight: 800; line-height: 1; }
.nutrition-unit { margin-top: 6rpx; color: #8a948d; font-size: 9px; line-height: 1; }
.nutrition-analysis { display: block; margin-top: 18rpx; padding-top: 15rpx; border-top: 1rpx solid #edf2ee; color: #5f6962; font-size: 10px; line-height: 1.75; }
.nutrition-analysis-label { color: #4eaa5c; font-weight: 700; }
.nutrition-disclaimer { display: block; margin-top: 10rpx; color: #a0a7a2; font-size: 8px; line-height: 1.5; }
.recipe-action-btn { display: flex; align-items: center; justify-content: center; gap: 9rpx; height: 82rpx; margin: 0; padding: 0 14rpx; border: 1rpx solid #dfe9e1; border-radius: 14px; color: #477f50; background: #f5faf6; font-size: 12px; font-weight: 800; line-height: 1; box-shadow: none; }
.recipe-action-btn::after { border: none; }
.favorite-action { color: #fff; border-color: #58b663; background: linear-gradient(135deg,#70c977,#4cae57); box-shadow: 0 8rpx 16rpx rgba(58,116,66,.16); }
.favorite-action.active { color: #4f7755; border-color: #dce8de; background: #edf5ee; box-shadow: none; }
.complete-action { color: #fff; border-color: #62bc6c; background: linear-gradient(135deg,#75ca7c,#54b55f); }
.plan-action { color: #438d4e; border-color: #cae2ce; background: #f1f8f2; }
.action-symbol { font-size: 17px; font-weight: 500; line-height: 1; }
.favorite-symbol { font-family: "iconfont" !important; font-style: normal; font-weight: 400; }
.complete-cook-action { color: #fff; border-color: #58b663; background: linear-gradient(135deg,#70c977,#4cae57); box-shadow: 0 8rpx 16rpx rgba(58,116,66,.16); }
.complete-cook-action[disabled] { color: #66806b; background: #e8f1e9; box-shadow: none; }
.complete-cook-action::after { border: none; }
.complete-cook-icon { font-family: "completion-icon" !important; font-size: 17px; font-style: normal; font-weight: 400; line-height: 1; }
.plan-wide-action { width: 100%; margin-top: 12rpx; }
.basket-action-icon { color: #55a961; font-family: "iconfont" !important; font-size: 18px; }
.modal-mask { position: fixed; inset: 0; z-index: 2200; display: flex; align-items: flex-end; background: rgba(20,29,23,.48); }
.plan-modal { width: 100%; max-height: 88vh; overflow-y: auto; box-sizing: border-box; padding: 30rpx 26rpx calc(36rpx + env(safe-area-inset-bottom)); border-radius: 24px 24px 0 0; background: #fff; box-shadow: 0 -12rpx 38rpx rgba(18,37,22,.16); }
.completion-mask { align-items: center; justify-content: center; padding: 16px; }
.completion-modal { display: flex; width: 100%; max-width: 710rpx; max-height: 78vh; box-sizing: border-box; flex-direction: column; padding: 16px 14px; border-radius: 20px; background: #fff; box-shadow: 0 16rpx 32rpx rgba(15,28,20,.22); }
.completion-title { display: block; color: #6f9fea; font-size: 20px; font-weight: 700; }
.completion-modal-sub { display: block; margin-top: 6rpx; color: #8c98a7; font-size: 10px; line-height: 1.5; }
.completion-list { max-height: 48vh; margin: 14rpx 0 18rpx; }
.completion-item { display: flex; align-items: center; justify-content: space-between; gap: 12rpx; padding: 18rpx 0; border-bottom: 1rpx solid #edf1f6; }
.completion-item-main { min-width: 100rpx; flex: 1; }
.completion-item-name { display: block; color: #1f2329; font-size: 16px; font-weight: 700; line-height: 1.35; }
.completion-item-meta { display: block; margin-top: 5rpx; color: #8b96a3; font-size: 9px; }
.completion-quantity { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.quantity-step { display: flex; align-items: center; justify-content: center; width: 34px; height: 40px; margin: 0; padding: 0; border: none; border-radius: 12px; color: #202b38; background: #f7faff; font-size: 20px; font-weight: 700; line-height: 40px; box-shadow: none; }
.quantity-step::after { border: none; }
.quantity-input { width: 58px; height: 40px; box-sizing: border-box; border: 1rpx solid #dfe6f3; border-radius: 12px; color: #202b38; background: #fff; font-size: 18px; text-align: center; }
.quantity-unit { display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 40px; box-sizing: border-box; padding: 0 7px; border-radius: 12px; color: #fff; background: linear-gradient(135deg,#83b4ff,#5f95f2); font-size: 13px; font-weight: 700; }
.completion-empty,.completion-unmatched { margin-top: 10rpx; padding: 14rpx; border-radius: 11px; color: #7e8998; background: #f7faff; font-size: 10px; line-height: 1.6; }
.completion-unmatched { color: #96714f; background: #fff8f1; }
.completion-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.confirm-completion-btn,.completion-cancel-btn { width: 100%; height: 46px; margin: 0; padding: 0; border: none; border-radius: 999rpx; font-size: 16px; font-weight: 700; line-height: 46px; box-shadow: none; }
.confirm-completion-btn { color: #fff; background: linear-gradient(135deg,#83b4ff,#5f95f2); }
.completion-cancel-btn { color: #596579; border: 1rpx solid #dce5f2; background: #f7faff; }
.confirm-completion-btn::after,.completion-cancel-btn::after { border: none; }
.modal-head { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28rpx; }
.modal-title { display: block; color: #202a22; font-size: 18px; font-weight: 800; }
.modal-close { padding: 0 8rpx; color: #9ba39d; font-size: 28px; line-height: 1; }
.field-label { display: block; margin: 20rpx 0 12rpx; color: #4d5950; font-size: 12px; font-weight: 700; }
.meal-options { display: grid; grid-template-columns: repeat(3,1fr); gap: 12rpx; }
.meal-option { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8rpx; height: 98rpx; border: 1rpx solid #e3e9e5; border-radius: 13px; color: #6f7a72; background: #fafbfa; font-size: 11px; }
.meal-option.active { color: #439450; border-color: #8ed09a; background: #edf8ef; font-weight: 700; }
.meal-option-icon { display: block; width: 44rpx; height: 44rpx; }
.confirm-plan-btn { width: 88%; margin: 28rpx auto 0; padding: 13px 12px; border: none; border-radius: 14px; color: #fff; background: linear-gradient(135deg,#70c977,#4cae57); box-shadow: 0 9rpx 18rpx rgba(58,116,66,.19); font-size: 14px; font-weight: 800; }
.confirm-plan-btn::after { border: none; }
</style>
