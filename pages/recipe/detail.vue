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
					<text class="title">{{ recipe.name }}</text>
					<text class="meta">{{ recipe.servings }}人份 · {{ recipe.duration }}分钟 · {{ recipe.difficulty }}</text>
				</view>
				<button v-if="fromFavorite && favorited" class="head-unfavorite-btn" @click="unfavorite">取消收藏</button>
			</view>
			<view class="recipe-banner">
				<view class="banner-title-row">
					<text class="banner-title">所需食材</text>
					<text class="banner-count" :class="{ missing: missingIngredientCount > 0 }">{{ missingIngredientCount > 0 ? `还需${missingIngredientCount}种` : '食材齐全' }}</text>
				</view>
				<view v-if="availableIngredientItems.length" class="ingredient-group available">
					<text class="ingredient-group-label">冰箱已有</text>
					<text class="ingredient-group-text">{{ formatIngredientItems(availableIngredientItems) }}</text>
				</view>
				<view v-if="missingIngredientItems.length" class="ingredient-group missing">
					<text class="ingredient-group-label">还需准备</text>
					<text class="ingredient-group-text">{{ formatIngredientItems(missingIngredientItems) }}</text>
				</view>
			</view>
			<view v-if="detailLoading" class="detail-loading-card">
				<view class="detail-loading-dot"></view>
				<view>
					<text class="detail-loading-title">正在生成详细做法</text>
					<text class="detail-loading-meta">同时估算每人份营养数据，请稍候…</text>
				</view>
			</view>
			<view v-else-if="detailError" class="detail-error-card">
				<text class="detail-error-text">{{ detailError }}</text>
				<button class="detail-retry-btn" @click="retryLoadDetail">重新生成</button>
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
			<view v-if="hasNutrition" class="nutrition-card">
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
		<view class="favorite-wrap">
			<view class="action-grid single">
				<button v-if="!fromFavorite" class="btn" :class="favorited ? 'done' : 'primary'" @click="favorite">{{ favorited ? '已收藏' : '收藏该菜谱' }}</button>
				<button v-if="fromFavorite" class="btn complete-btn" @click="completeRecipe">{{ completeButtonText }}</button>
			</view>
			<button class="btn basket-btn" @click="addMissingToBasket">加入缺少食材到菜篮子</button>
			<text v-if="fromFavorite && lastCompletedAt" class="complete-meta">最近完成：{{ formatDateTime(lastCompletedAt) }}</text>
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
	upsertBasketItems as upsertBasketItemsLocal
} from '@/store/app-store'
import { getIngredientList } from '@/api/modules/ingredients'
import { upsertBasketItems as upsertBasketItemsApi } from '@/api/modules/basket'
import { getRecipeDetail } from '@/api/modules/recipes'
import { synthesizeAssistantSpeech } from '@/api/modules/ai'
import { playSpeechAudio } from '@/utils/speech-audio'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import NutritionIcon from '@/components/nutrition-icon.vue'
import { toSmartBasketItem } from '@/utils/smart-purchase'

const RECIPE_DETAIL_CACHE_PREFIX = 'FFA_RECIPE_DETAIL_V2_'

export default {
	components: { BottomNav, IngredientIcon, NutritionIcon },
	data() {
		return {
			fromFavorite: false,
			favorited: false,
			detailLoading: false,
			detailError: '',
			completedCount: 0,
			lastCompletedAt: '',
			isRecipeSynthesizing: false,
			isRecipeSpeaking: false,
			recipeAudioContext: null,
			pantryNames: [],
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
		completeButtonText() {
			return this.completedCount > 0 ? `已完成 ${this.completedCount}次` : '标记已完成'
		},
		hasRecipeDetail() {
			return Array.isArray(this.recipe.steps) && this.recipe.steps.length > 0
		},
		hasNutrition() {
			return !!this.recipe?.nutrition && this.nutritionItems.some((item) => Number(item.rawValue) > 0)
		},
		availableIngredientItems() {
			return this.ingredientDisplayItems.filter((item) => !item.isMissing)
		},
		missingIngredientItems() {
			return this.ingredientDisplayItems.filter((item) => item.isMissing)
		},
		missingIngredientCount() {
			return this.missingIngredientItems.length
		},
		ingredientDisplayItems() {
			const pantrySet = new Set(this.pantryNames.map((name) => this.normalizeName(name)).filter(Boolean))
			const withAvailability = (item) => ({
				...item,
				isMissing: pantrySet.size > 0 && !pantrySet.has(this.normalizeName(item.name))
			})
			const rawItems = Array.isArray(this.recipe?.raw?.ingredients)
				? this.recipe.raw.ingredients.map((item) => {
					const name = `${item?.name || ''}`.trim()
					const quantity = item?.quantity === undefined || item?.quantity === null ? '' : `${item.quantity}`.trim()
					const unit = `${item?.unit || ''}`.trim()
					return { name, amount: `${quantity}${unit}`.trim() }
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
		this.loadPantryNames()
		this.fromFavorite = !!(query && query.fromFavorite === '1')
		const cached = uni.getStorageSync('latestRecipeDetail')
		if (cached && typeof cached === 'object') this.applyRecipeFromRaw(cached)
		if (query && query.name) this.recipe.name = decodeURIComponent(query.name)
		this.syncFavoriteState(this.fromFavorite)
		this.ensureRecipeDetail()
	},
	onShow() {
		this.ensureShareMenu()
	},
	onUnload() {
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
		initRecipeAudio() {
			if (typeof uni.createInnerAudioContext !== 'function') return
			const audio = uni.createInnerAudioContext()
			audio.autoplay = false
			audio.onPlay(() => {
				this.isRecipeSpeaking = true
			})
			audio.onEnded(() => {
				this.isRecipeSpeaking = false
			})
			audio.onStop(() => {
				this.isRecipeSpeaking = false
			})
			audio.onError((error) => {
				console.error('菜谱播放失败', error)
				this.isRecipeSpeaking = false
				this.isRecipeSynthesizing = false
				uni.showToast({ title: '菜谱朗读失败，请重试', icon: 'none' })
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
			try {
				const res = await getIngredientList()
				const items = this.unwrapListPayload(res)
				const names = items.map((item) => `${item?.name || ''}`.trim()).filter(Boolean)
				if (names.length) {
					this.pantryNames = names
					return
				}
			} catch (_) {}
			const storedIngredients = uni.getStorageSync('latestPantryIngredients')
			const storedTags = uni.getStorageSync('latestPantryTags')
			this.pantryNames = Array.isArray(storedIngredients) && storedIngredients.length
				? storedIngredients.map((item) => `${item?.name || ''}`.trim()).filter(Boolean)
				: (Array.isArray(storedTags) ? storedTags.map((name) => `${name || ''}`.trim()).filter(Boolean) : [])
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
			return !!recipe && Array.isArray(recipe.steps) && recipe.steps.length > 0 && !!recipe.nutrition
		},
		async ensureRecipeDetail(force = false) {
			if (this.detailLoading) return
			if (!force) {
				const cached = this.readDetailCache()
				if (this.isDetailComplete(cached)) {
					this.applyRecipeFromRaw(cached)
					uni.setStorageSync('latestRecipeDetail', cached)
					return
				}
				if (this.isDetailComplete(this.recipe?.raw)) return
			}
			this.detailLoading = true
			this.detailError = ''
			try {
				const summary = this.recipe?.raw && typeof this.recipe.raw === 'object'
					? this.recipe.raw
					: {
						name: this.recipe.name,
						duration: this.recipe.duration,
						difficulty: this.recipe.difficulty,
						ingredients: this.pickRecipeIngredientItems()
					}
				const res = await getRecipeDetail({ recipe: summary })
				const detail = res?.data?.recipe || res?.recipe
				if (!this.isDetailComplete(detail)) throw new Error('详情内容不完整')
				const summaryIngredients = Array.isArray(summary?.ingredients) ? summary.ingredients : []
				const resolvedDetail = summaryIngredients.length ? { ...detail, ingredients: summaryIngredients } : detail
				this.applyRecipeFromRaw(resolvedDetail)
				this.writeDetailCache(resolvedDetail)
				uni.setStorageSync('latestRecipeDetail', resolvedDetail)
			} catch (error) {
				const message = `${error?.message || error?.msg || error?.data?.message || ''}`.trim()
				this.detailError = message || '详细做法生成失败，请重试'
			} finally {
				this.detailLoading = false
			}
		},
		retryLoadDetail() {
			this.ensureRecipeDetail(true)
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
			const stepList = Array.isArray(raw?.steps) ? raw.steps.map((x) => `${x || ''}`.trim()).filter(Boolean) : []
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
		favorite() {
			if (this.favorited) {
				uni.showToast({ title: '已在收藏中', icon: 'none' })
				return
			}
			const ok = addFavoriteRecipe({
				name: this.recipe.name,
				available: this.recipe.ingredients.slice(0, 2),
				missing: [],
				duration: this.recipe.duration,
				difficulty: this.recipe.difficulty,
				raw: this.recipe.raw || null
			})
			if (!ok) {
				this.favorited = true
				uni.showToast({ title: '已在收藏中', icon: 'none' })
				return
			}
			this.favorited = true
			this.syncFavoriteState()
			uni.showToast({ title: '已加入收藏', icon: 'success' })
		},
		completeRecipe() {
			if (!this.favorited) {
				uni.showToast({ title: '请先收藏菜谱', icon: 'none' })
				return
			}
			const updated = markFavoriteRecipeCompleted(this.recipe.name)
			if (!updated) {
				uni.showToast({ title: '标记失败，请重试', icon: 'none' })
				return
			}
			this.completedCount = Number(updated.completedCount || 0)
			this.lastCompletedAt = updated.lastCompletedAt || ''
			uni.showToast({ title: '已标记完成', icon: 'success' })
		},
		unfavorite() {
			if (!this.favorited) {
				uni.showToast({ title: '当前未收藏', icon: 'none' })
				return
			}
			uni.showModal({
				title: '取消收藏',
				content: '确认取消收藏该菜谱吗？',
				success: (res) => {
					if (!res.confirm) return
					const ok = removeFavoriteRecipe(this.recipe.name)
					if (!ok) {
						uni.showToast({ title: '取消失败，请重试', icon: 'none' })
						return
					}
					this.favorited = false
					this.completedCount = 0
					this.lastCompletedAt = ''
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
			const pantrySet = new Set(pantryList.map((x) => this.normalizeName(x?.name)).filter(Boolean))
			const missing = recipeItems.filter((x) => !pantrySet.has(this.normalizeName(x.name)))
			if (!missing.length) {
				uni.showToast({ title: '当前食材充足，无需加入', icon: 'none' })
				return
			}
			let result = { added: 0, merged: 0 }
			const payload = missing.map((x) => toSmartBasketItem(x))
			try {
				result = await upsertBasketItemsApi(payload, this.recipe.name, 1)
			} catch (e) {
				// Fallback keeps legacy local flow if backend is unavailable.
				result = upsertBasketItemsLocal(payload, this.recipe.name)
			}
			uni.showToast({ title: `已加入菜篮子（${result.added + result.merged}项）`, icon: 'success' })
		},
		backToResult() {
			const pages = getCurrentPages()
			const openWithRedirect = (url) => {
				uni.redirectTo({
					url,
					fail: () => {
						uni.reLaunch({ url })
					}
				})
			}
			const safeOpen = (url) => {
				if (Array.isArray(pages) && pages.length >= 9) {
					openWithRedirect(url)
					return
				}
				uni.navigateTo({
					url,
					fail: (err) => {
						const msg = `${err?.errMsg || ''}`
						if (msg.includes('webview count limit exceed')) {
							openWithRedirect(url)
							return
						}
						uni.showToast({ title: '页面跳转失败', icon: 'none' })
					}
				})
			}
			if (this.fromFavorite) {
				safeOpen('/pages/profile/favorites')
				return
			}
			safeOpen('/pages/recipe/result')
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
.action-grid.single { grid-template-columns: 1fr; }
.complete-meta { display: block; font-size: 11px; color: #7f8c83; margin-top: 8rpx; padding-left: 4rpx; }
.title { display: block; font-size: 18px; line-height: 1.35; font-weight: 800; color: #1f2922; }
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
.btn { width: 100%; border: none; border-radius: 16rpx; padding: 14rpx 12rpx; color: #fff; font-size: 14px; font-weight: 700; box-shadow: 0 8rpx 16rpx rgba(58,116,66,.22); }
.btn::after { border: none; }
.primary { background: linear-gradient(135deg,#70c977,#4cae57); }
.done { background: #dfece2; color: #4f6b56; box-shadow: none; }
.complete-btn { background: linear-gradient(135deg,#83d38a,#5bb967); }
.basket-btn { margin-top: 10rpx; background: #eef5ef; color: #4b8f56; box-shadow: none; }
</style>
