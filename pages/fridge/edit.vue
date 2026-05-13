<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back-left" @click="goBackToList">
				<text class="back-arrow">‹</text>
			</view>
			<text class="top-title">编辑食材</text>
		</view>
		<view class="card top-card">
			<view class="food-ico">
				<IngredientIcon :name="form.name" :category="form.category" :size="54" />
			</view>
			<view class="top-main">
				<text class="food-name">{{ form.name || '食材' }}</text>
				<text class="food-time">{{ form.createdAt || '-' }}</text>
			</view>
			<view class="related-wrap">
				<button
					class="related-btn"
					:disabled="isRelatedGenerating || !form.name"
					@click="generateRelatedRecipes"
				>
					<text class="related-btn-icon">✦</text>
					<text>{{ relatedButtonText }}</text>
				</button>
			</view>
		</view>

		<view class="card form-card">
			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◍</text>
					<text class="row-label">食材名称</text>
				</view>
				<input v-model="form.name" class="row-input" placeholder="请输入食材名称" />
			</view>

			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">☰</text>
					<text class="row-label">食材类型</text>
				</view>
				<picker :range="categories" @change="onCategoryChange" class="flex-picker">
					<view class="row-chip">{{ form.category || '请选择类型' }}</view>
				</picker>
			</view>

			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◫</text>
					<text class="row-label">数量</text>
				</view>
				<input v-model="form.quantity" class="qty-input" type="number" placeholder="请输入数量" />
				<picker :range="units" @change="onUnitChange">
					<view class="row-chip unit-chip">{{ form.unit || '选择单位' }}</view>
				</picker>
			</view>

			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">☰</text>
					<text class="row-label">分区</text>
				</view>
				<view class="zone-row">
					<view
						v-for="loc in locations"
						:key="loc"
						class="zone-opt"
						:class="{ active: form.location === loc }"
						@click="form.location = loc"
					>
						<text class="dot"></text>
						<text>{{ loc }}</text>
					</view>
				</view>
			</view>

			<view class="form-row date-row">
				<view class="row-left">
					<text class="row-icon ai-iconfont expire-icon">&#xe621;</text>
					<text class="row-label">过期时间</text>
				</view>
				<picker mode="date" :value="form.expireDate" @change="onDateChange" class="flex-picker">
					<view class="row-date">{{ form.expireDate || '选择过期时间' }}</view>
				</picker>
			</view>
		</view>
		<view class="grid2 action-row">
			<button class="del-btn" @click="remove">删除</button>
			<button class="save-btn" @click="save">更新</button>
		</view>
		<BottomNav current="fridge" />
	</view>
</template>

<script>
import { deleteIngredient, getIngredientDetail, getIngredientList, updateIngredient } from '@/api/modules/ingredients'
import { recommendRecipes } from '@/api/modules/recipes'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import { getCurrentUserId } from '@/utils/current-user'

export default {
	components: { BottomNav, IngredientIcon },
	computed: {
		relatedButtonText() {
			if (!this.isRelatedGenerating) return '相关菜谱'
			return `生成中 ${Math.max(1, Math.min(99, Math.round(this.relatedProgress || 0)))}%`
		}
	},
	data() {
		return {
			ingredientId: '',
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			units: [
				'份', '盒', '罐', '包', '个', '条', '片', '根', '瓶', '袋', '块',
				'毫升', '升', '千克', '克', '斤', '公斤', '颗', '组', '把', '只', '杯',
				'支', '粒', '碗', '枚', '盘', '卷', '段', '篮', '捆', '串', '排',
				'桶', '箱', '颗', '朵', '管', '两'
			],
			locations: ['冷藏', '冷冻'],
			form: {
				name: '',
				category: '',
				quantity: '',
				unit: '',
				location: '',
				purchaseDate: '',
				expireDate: '',
				createdAt: ''
			},
			isRelatedGenerating: false,
			relatedProgress: 0,
			relatedProgressTimer: null
		}
	},
	onLoad(options) {
		const rawId = options?.id ?? options?.ingredientId ?? ''
		const id = `${rawId}`.trim()
		if (id && id !== 'undefined' && id !== 'null') {
			this.ingredientId = id
			this.fetchDetail()
			return
		}
		uni.showToast({
			title: '食材ID缺失',
			icon: 'none'
		})
	},
	methods: {
		startRelatedProgress() {
			this.stopRelatedProgress()
			this.relatedProgress = 1
			this.relatedProgressTimer = setInterval(() => {
				if (!this.isRelatedGenerating) return
				if (this.relatedProgress >= 96) return
				if (this.relatedProgress < 20) {
					this.relatedProgress += 1
					return
				}
				if (this.relatedProgress < 45) {
					this.relatedProgress += 1.6
					return
				}
				if (this.relatedProgress < 70) {
					this.relatedProgress += 2
					return
				}
				if (this.relatedProgress < 88) {
					this.relatedProgress += 1.2
					return
				}
				this.relatedProgress += 0.35
			}, 700)
		},
		finishRelatedProgress() {
			return new Promise((resolve) => {
				const from = Math.max(1, Number(this.relatedProgress || 0))
				const to = 100
				const totalMs = 1200
				const stepMs = 60
				const stepCount = Math.max(1, Math.floor(totalMs / stepMs))
				let currentStep = 0
				const timer = setInterval(() => {
					currentStep += 1
					const ratio = Math.min(1, currentStep / stepCount)
					this.relatedProgress = from + (to - from) * ratio
					if (ratio >= 1) {
						clearInterval(timer)
						this.relatedProgress = 100
						resolve()
					}
				}, stepMs)
			})
		},
		stopRelatedProgress() {
			if (this.relatedProgressTimer) {
				clearInterval(this.relatedProgressTimer)
				this.relatedProgressTimer = null
			}
		},
		normalizeNameForCompare(text) {
			return `${text || ''}`
				.toLowerCase()
				.replace(/[（(].*?[）)]/g, '')
				.replace(/[^a-z0-9\u4e00-\u9fa5]/g, '')
		},
		recipeIncludesIngredient(recipe, ingredientName) {
			const key = this.normalizeNameForCompare(ingredientName)
			if (!key) return false
			const haystack = [
				`${recipe?.name || ''}`,
				...(Array.isArray(recipe?.ingredients) ? recipe.ingredients.map((x) => `${x?.name || ''}`) : []),
				...(Array.isArray(recipe?.steps) ? recipe.steps.map((x) => `${x || ''}`) : [])
			]
				.join(' ')
				.toLowerCase()
			const normalized = this.normalizeNameForCompare(haystack)
			return normalized.includes(key)
		},
		openRecipeResultPage() {
			const target = '/pages/recipe/result'
			const openWithRedirect = () => {
				uni.redirectTo({
					url: target,
					fail: () => {
						uni.reLaunch({ url: target })
					}
				})
			}
			const pages = getCurrentPages()
			if (Array.isArray(pages) && pages.length >= 9) {
				openWithRedirect()
				return
			}
			uni.navigateTo({
				url: target,
				fail: (err) => {
					const msg = `${err?.errMsg || ''}`
					if (msg.includes('webview count limit exceed')) {
						openWithRedirect()
						return
					}
					uni.showToast({ title: '页面跳转失败', icon: 'none' })
				}
			})
		},
		normalizeIngredientItem(item) {
			return {
				name: `${item?.name || ''}`.trim(),
				quantity: Number(item?.quantity || 1),
				unit: `${item?.unit || ''}`.trim(),
				category: `${item?.category || ''}`.trim()
			}
		},
		async generateRelatedRecipes() {
			if (this.isRelatedGenerating) return
			const focusName = `${this.form.name || ''}`.trim()
			if (!focusName) {
				uni.showToast({ title: '当前食材名称为空', icon: 'none' })
				return
			}
			this.isRelatedGenerating = true
			this.startRelatedProgress()
			try {
				const userId = getCurrentUserId()
				const listRes = await getIngredientList({ userId })
				const list = Array.isArray(listRes) ? listRes : []
				const normalizedList = list.map((x) => this.normalizeIngredientItem(x)).filter((x) => !!x.name)
				const currentItem = this.normalizeIngredientItem(this.form)
				const pantryIngredients = normalizedList.length ? normalizedList : [currentItem]
				const hasFocus = pantryIngredients.some((x) => this.normalizeNameForCompare(x.name) === this.normalizeNameForCompare(focusName))
				const requestIngredients = hasFocus ? pantryIngredients : [currentItem, ...pantryIngredients]
				const aiRes = await recommendRecipes({
					userId,
					ingredients: requestIngredients,
					tastePreference: '家常',
					cookingTime: 30,
					count: 6
				})
				const fullPantryRecipes = (Array.isArray(aiRes?.data?.recipes) ? aiRes.data.recipes : [])
					.filter((x) => this.recipeIncludesIngredient(x, focusName))
				const profileApplied = aiRes?.data?.profileApplied || null
				const focusedRes = await recommendRecipes({
					userId,
					ingredients: [currentItem],
					tastePreference: '家常',
					cookingTime: 30,
					count: 6
				})
				const singleFocusedRecipes = (Array.isArray(focusedRes?.data?.recipes) ? focusedRes.data.recipes : [])
					.filter((x) => this.recipeIncludesIngredient(x, focusName))
				const merged = [...singleFocusedRecipes, ...fullPantryRecipes]
				const seen = new Set()
				const recipes = merged.filter((item) => {
					const key = this.normalizeNameForCompare(item?.name)
					if (!key || seen.has(key)) return false
					seen.add(key)
					return true
				})
				if (!recipes.length) {
					uni.showToast({ title: '暂未生成该食材相关菜谱', icon: 'none' })
					return
				}
				await this.finishRelatedProgress()
				await new Promise((resolve) => setTimeout(resolve, 180))
				const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
				uni.setStorageSync('latestGeneratedRecipes', recipes.slice(0, 6))
				uni.setStorageSync('latestGeneratedBatchId', batchId)
				uni.setStorageSync('latestRecipeProfileApplied', profileApplied)
				uni.setStorageSync('latestPantryTags', [focusName])
				uni.setStorageSync('latestPantryIngredients', requestIngredients)
				this.openRecipeResultPage()
			} catch (e) {
				console.error('生成相关菜谱失败', e)
				uni.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
			} finally {
				this.stopRelatedProgress()
				this.isRelatedGenerating = false
				this.relatedProgress = 0
			}
		},
		goBackToList() {
			if (getCurrentPages().length > 1) {
				uni.navigateBack()
				return
			}
			uni.redirectTo({
				url: '/pages/fridge/list',
				fail: () => {
					uni.reLaunch({ url: '/pages/fridge/list' })
				}
			})
		},
		pickPayload(source) {
			if (!source || typeof source !== 'object') return source
			if (source.data && typeof source.data === 'object') {
				const nested = source.data
				if (nested.data && typeof nested.data === 'object') return nested.data
				return nested
			}
			return source
		},
		getField(data, keys) {
			for (const key of keys) {
				if (data && data[key] !== undefined && data[key] !== null) return data[key]
			}
			return ''
		},
		applyDetail(data) {
			this.form.name = this.getField(data, ['name', 'ingredientName'])
			this.form.category = this.getField(data, ['category', 'type'])
			this.form.quantity = this.getField(data, ['quantity', 'qty'])
			this.form.unit = this.getField(data, ['unit'])
			const location = this.getField(data, ['location', 'zone'])
			this.form.location = this.locations.includes(location) ? location : '冷藏'
			const expireDate = this.getField(data, ['expireDate', 'expire_date'])
			const purchaseDate = this.getField(data, ['purchaseDate', 'purchase_date', 'createdAt', 'created_at'])
			const createdAt = this.getField(data, ['createdAt', 'created_at', 'purchaseDate', 'purchase_date'])
			this.form.expireDate = expireDate ? `${expireDate}`.slice(0, 10) : ''
			this.form.purchaseDate = purchaseDate ? `${purchaseDate}`.slice(0, 10) : ''
			this.form.createdAt = createdAt ? `${createdAt}`.slice(0, 10) : ''
		},
		onCategoryChange(e) {
			this.form.category = this.categories[e.detail.value]
		},
		onUnitChange(e) {
			this.form.unit = this.units[e.detail.value]
		},
		onLocationChange(e) {
			this.form.location = this.locations[e.detail.value]
		},
		onDateChange(e) {
			const value = e?.detail?.value || ''
			const today = new Date().toISOString().slice(0, 10)
			if (value && value < today) {
				uni.showToast({ title: '过期日期不能早于今天', icon: 'none' })
				this.form.expireDate = ''
				return
			}
			this.form.expireDate = value
		},
		onPurchaseDateChange(e) {
			this.form.purchaseDate = e.detail.value
		},
		async fetchDetail() {
			try {
				const res = await getIngredientDetail(this.ingredientId)
				const data = this.pickPayload(res)
				this.applyDetail(data)
			} catch (e) {
				// Fallback for backends without GET /ingredients/:id.
				try {
					const listRes = await getIngredientList()
					const list = Array.isArray(listRes) ? listRes : []
					const current = list.find((x) => `${x.id}` === `${this.ingredientId}`)
					if (!current) {
						uni.showToast({
							title: '未找到食材数据',
							icon: 'none'
						})
						return
					}
					this.applyDetail(current)
				} catch (fallbackErr) {
					console.error('获取食材失败', fallbackErr)
					uni.showToast({
						title: '获取食材失败',
						icon: 'none'
					})
				}
			}
		},
		async save() {
			const today = new Date().toISOString().slice(0, 10)

			if (!this.form.name || !this.form.category || !this.form.quantity || !this.form.unit || !this.form.location || !this.form.expireDate) {
				uni.showToast({ title: '请先填写完整信息', icon: 'none' })
				return
			}

			if (this.form.expireDate < today) {
				uni.showToast({ title: '过期日期不能早于今天', icon: 'none' })
				return
			}

			if (!this.ingredientId) {
				uni.showToast({ title: '食材ID缺失', icon: 'none' })
				return
			}

			try {
				await updateIngredient(this.ingredientId, {
					name: this.form.name,
					category: this.form.category,
					quantity: Number(this.form.quantity),
					unit: this.form.unit,
					location: this.form.location,
					expireDate: this.form.expireDate
				})

				uni.showToast({ title: '已保存', icon: 'success' })

				setTimeout(() => {
					uni.navigateBack()
				}, 300)
			} catch (e) {
				console.error('更新失败', e)
				uni.showToast({ title: '保存失败', icon: 'none' })
			}
		},
		async remove() {
			if (!this.ingredientId) {
				uni.showToast({ title: '食材ID缺失', icon: 'none' })
				return
			}

			try {
				await deleteIngredient(this.ingredientId)

				uni.showToast({ title: '已删除', icon: 'success' })

				setTimeout(() => {
					uni.navigateBack()
				}, 300)
			} catch (e) {
				console.error('删除失败', e)
				uni.showToast({ title: '删除失败', icon: 'none' })
			}
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
	align-items: center;
	gap: 10rpx;
	margin-bottom: 8rpx;
}

.top-title {
	font-size: 20px;
	font-weight: 700;
}

.back-left { width: 30px; height: 30px; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; }
.back-arrow { font-size: 30px; line-height: 1; color: #c7ced9; transform: translateY(-1px); }

.card {
	background: #fff;
	border: 1rpx solid #edf2ef;
	border-radius: 16px;
	padding: 12px;
	margin-bottom: 18rpx;
	box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07);
}

.top-card {
	display: grid;
	grid-template-columns: 72px minmax(0, 1fr) auto;
	gap: 14rpx;
	align-items: center;
}

.top-main {
	min-width: 0;
}

.food-ico {
	width: 72px;
	height: 72px;
	border-radius: 14px;
	background: #f1f8f2;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 34px;
}

.food-name {
	font-weight: 700;
	font-size: 16px;
}

.food-time {
	display: block;
	font-size: 12px;
	color: #738177;
	margin-top: 6rpx;
}

.related-wrap {
	display: flex;
	align-items: center;
}

.related-btn {
	height: 36px;
	line-height: 36px;
	padding: 0 18px;
	border-radius: 999rpx;
	border: 1rpx solid #cfead4;
	background: #edf9ef;
	color: #45a655;
	font-size: 12px;
	font-weight: 700;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6rpx;
	box-shadow: 0 4rpx 10rpx rgba(69, 166, 85, 0.12);
}

.related-btn-icon {
	font-size: 13px;
	line-height: 1;
	color: #45a655;
}

.related-btn[disabled] {
	opacity: 0.7;
}

.related-btn::after {
	border: none;
}

.form-card {
	padding: 10px;
}

.ai-iconfont {
	font-family: "iconfont" !important;
	font-style: normal;
	font-weight: 400;
	line-height: 1;
	color: #4cae57;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.form-row {
	display: flex;
	align-items: center;
	background: #f4f8f5;
	border-radius: 8px;
	padding: 10px 12px;
	margin-bottom: 12rpx;
	min-height: 52px;
	box-sizing: border-box;
}

.row-left {
	display: grid;
	grid-template-columns: 30px auto;
	align-items: center;
	min-width: 132px;
	flex-shrink: 0;
	column-gap: 8rpx;
}

.row-icon {
	color: #6aa97a;
	font-size: 19px;
	width: 30px;
	height: 30px;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	text-align: center;
	transform: translateY(-2px);
}

.expire-icon {
	color: #4cae57 !important;
}

.row-label {
	font-size: 14px;
	font-weight: 600;
	color: #26352d;
	line-height: 1.2;
	display: inline-flex;
	align-items: center;
}

.row-input {
	flex: 1;
	font-size: 13px;
	color: #2e3b33;
	padding: 0 8rpx;
}

.flex-picker {
	flex: 1;
}

.row-chip {
	background: linear-gradient(135deg, #70c977, #4cae57);
	color: #fff;
	border-radius: 10px;
	padding: 12rpx 10rpx;
	text-align: center;
	font-size: 13px;
	font-weight: 600;
}

.qty-input {
	flex: 1;
	font-size: 13px;
	color: #2e3b33;
	padding-left: 8rpx;
}

.unit-chip {
	min-width: 96px;
	padding: 12rpx 0;
}

.zone-row {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 14rpx;
}

.zone-opt {
	display: inline-flex;
	align-items: center;
	gap: 7rpx;
	font-size: 13px;
	color: #2d3a32;
}

.dot {
	width: 22px;
	height: 22px;
	border-radius: 50%;
	border: 2rpx solid #cfd8d2;
	background: #fff;
	display: flex;
	align-items: center;
	justify-content: center;
}

.zone-opt.active .dot {
	border-color: #67b374;
	background: #67b374;
}

.zone-opt.active .dot::after {
	content: '✓';
	color: #fff;
	font-size: 11px;
	font-weight: 700;
}

.date-row {
	background: #f4f8f5;
}

.row-date {
	font-size: 13px;
	color: #98a39d;
	padding-left: 6rpx;
}

.grid2 {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 16rpx;
	margin-top: 8rpx;
}

.action-row {
	margin-top: -4rpx;
	margin-bottom: 12rpx;
}

.del-btn {
	width: 100%;
	height: 42px;
	line-height: 42px;
	background: linear-gradient(135deg, #ff8d8d, #f36f7a);
	color: #fff;
	border-radius: 999rpx;
	font-size: 13px;
	font-weight: 700;
	box-shadow: 0 8rpx 16rpx rgba(243, 111, 122, 0.28);
	letter-spacing: 1rpx;
}

.save-btn {
	width: 100%;
	height: 42px;
	line-height: 42px;
	background: linear-gradient(135deg, #70c977, #4cae57);
	color: #fff;
	border-radius: 999rpx;
	font-weight: 700;
	font-size: 13px;
	box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.26);
	letter-spacing: 1rpx;
}

.del-btn::after,
.save-btn::after {
	border: none;
}
</style>
