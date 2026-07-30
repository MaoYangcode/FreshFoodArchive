<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back" @click="goBack"><text class="back-arrow">‹</text></view>
			<view class="top-copy">
				<text class="top-title">语音助手</text>
			</view>
		</view>

		<view class="chat-row assistant-row">
			<view class="chat-avatar">
				<image class="chat-avatar-image" src="/static/assistant/fridge-assistant.png" mode="aspectFit"></image>
			</view>
			<view class="assistant-bubble welcome-bubble">
				<text class="welcome-title">Hi，有什么可以帮你？</text>
				<text class="welcome-text">我可以帮你管理食材、查询库存和推荐菜谱。</text>
			</view>
		</view>

		<view class="examples">
			<text class="section-title">你可以这样说</text>
			<view class="example-list">
				<text v-for="example in examples" :key="example" class="example-chip" @click="tryExample(example)">{{ example }}</text>
			</view>
		</view>

		<view v-if="command" class="conversation">
			<view class="chat-row user-row">
				<view class="user-bubble">
					<text>{{ command.transcript || transcript }}</text>
				</view>
			</view>
			<view class="chat-row assistant-row result-row">
				<view class="chat-avatar small">
					<image class="chat-avatar-image" src="/static/assistant/fridge-assistant.png" mode="aspectFit"></image>
				</view>
				<view class="assistant-bubble result-bubble">
					<view class="result-head">
						<text class="intent-pill" :class="intentTone">{{ intentLabel }}</text>
					</view>
					<text class="assistant-reply">{{ command.reply }}</text>
					<view v-if="command.intent === 'inventory_read' && inventoryResult.length" class="inventory-result">
						<view v-for="(item, index) in inventoryResult" :key="`${item.name}-${item.unit}-${index}`" class="inventory-result-row">
							<view class="inventory-result-main">
								<text class="inventory-result-name">{{ item.name }}</text>
								<text class="inventory-result-location">{{ item.locations.join(' · ') }}</text>
							</view>
							<text class="inventory-result-amount">{{ formatQuantity(item.quantity) }}{{ item.unit }}</text>
						</view>
					</view>
					<view v-if="command.intent === 'expiry_read' && expiryResult.length" class="inventory-result expiry-result">
						<view v-for="(item, index) in expiryResult" :key="`expiry-${item.id}-${index}`" class="inventory-result-row">
							<view class="inventory-result-main">
								<text class="inventory-result-name">{{ item.name }}</text>
								<text class="inventory-result-location">{{ item.location }} · {{ formatExpireDate(item.expireDate) }}</text>
							</view>
							<text class="expiry-days" :class="{ expired: item.daysLeft < 0 }">{{ formatDaysLeft(item.daysLeft) }}</text>
						</view>
					</view>
					<view v-if="isPendingInventoryAdd" class="confirm-card">
						<view v-for="(item, index) in pendingItems" :key="`pending-${index}`" class="confirm-item">
							<view class="confirm-item-head">
								<text class="confirm-index">{{ index + 1 }}</text>
								<input v-model="item.name" class="confirm-name" placeholder="食材名称" />
							</view>
							<view class="confirm-fields">
								<view class="confirm-field quantity-field">
									<text class="confirm-label">数量</text>
									<input v-model="item.quantity" class="confirm-input" type="digit" />
								</view>
								<picker :range="units" :value="getOptionIndex(units, item.unit)" @change="onPendingUnitChange(index, $event)">
									<view class="confirm-field">
										<text class="confirm-label">单位</text>
										<text class="confirm-value">{{ item.unit }}</text>
									</view>
								</picker>
								<picker :range="categories" :value="getOptionIndex(categories, item.category)" @change="onPendingCategoryChange(index, $event)">
									<view class="confirm-field">
										<text class="confirm-label">类别</text>
										<text class="confirm-value">{{ item.category }}</text>
									</view>
								</picker>
								<picker :range="locations" :value="getOptionIndex(locations, item.location)" @change="onPendingLocationChange(index, $event)">
									<view class="confirm-field">
										<text class="confirm-label">位置</text>
										<text class="confirm-value">{{ item.location }}</text>
									</view>
								</picker>
							</view>
							<picker mode="date" :value="item.expireDate" @change="onPendingExpireDateChange(index, $event)">
								<view class="expire-field">
									<text class="confirm-label">预计过期</text>
									<text class="expire-value">{{ item.expireDate }}</text>
									<text class="picker-arrow">›</text>
								</view>
							</picker>
						</view>
						<view class="confirm-actions">
							<button class="cancel-btn" :disabled="isSubmitting" @click.stop="cancelInventoryAdd">取消</button>
							<button class="confirm-btn" :disabled="!canConfirmInventoryAdd" @click.stop="confirmInventoryAdd">
								{{ isSubmitting ? '入库中…' : '确认入库' }}
							</button>
						</view>
					</view>
					<view v-if="isPendingInventoryConsume" class="confirm-card consume-card">
						<view v-for="(item, index) in pendingConsumeItems" :key="`consume-${item.name}-${index}`" class="confirm-item">
							<view class="consume-item-head">
								<view>
									<text class="consume-name">{{ item.name }}</text>
									<text class="consume-stock">当前库存 {{ formatQuantity(item.available) }}{{ item.unit }}</text>
								</view>
								<view class="consume-quantity">
									<text class="consume-step" @click.stop="changeConsumeQuantity(index, -1)">−</text>
									<input v-model="item.quantity" class="consume-input" type="digit" />
									<text class="consume-step" @click.stop="changeConsumeQuantity(index, 1)">＋</text>
								</view>
							</view>
						</view>
						<view class="confirm-actions">
							<button class="cancel-btn" :disabled="isSubmitting" @click.stop="cancelInventoryConsume">取消</button>
							<button class="consume-confirm-btn" :disabled="!canConfirmInventoryConsume" @click.stop="confirmInventoryConsume">
								{{ isSubmitting ? '出库中…' : '确认出库' }}
							</button>
						</view>
					</view>
					<view v-if="command.items && command.items.length && !isPendingInventoryAdd" class="command-section">
						<text class="field-label">涉及食材</text>
						<view class="item-list">
							<view v-for="(item, index) in command.items" :key="`${item.name}-${index}`" class="item-row">
								<text class="item-name">{{ item.name }}</text>
								<text class="item-meta">{{ formatItemMeta(item) }}</text>
							</view>
						</view>
					</view>
					<view v-if="recipeSummary" class="command-section">
						<text class="field-label">菜谱条件</text>
						<text class="summary-text">{{ recipeSummary }}</text>
					</view>
					<view class="safety-note">
						<text class="safety-dot"></text>
						<text>{{ safetyNote }}</text>
					</view>
					<view v-if="canSpeakCurrentResult" class="speak-action" @click.stop="speakCurrentResult">
						<text class="speak-icon">◉</text>
						<text>{{ isSpeaking ? '停止朗读' : (isSynthesizing ? '正在生成语音…' : '朗读结果') }}</text>
					</view>
				</view>
			</view>
			<view v-if="actionMessage" class="chat-row assistant-row execution-row">
				<view class="chat-avatar small">
					<image class="chat-avatar-image" src="/static/assistant/fridge-assistant.png" mode="aspectFit"></image>
				</view>
				<view class="assistant-bubble execution-bubble" :class="actionStatus">
					<text class="execution-message">{{ actionMessage }}</text>
				</view>
			</view>
		</view>

		<view class="voice-entry" :class="{ recording: isRecording }" @click="toggleRecording">
			<view class="voice-btn">
				<text class="assistant-iconfont voice-ico">&#xe61f;</text>
			</view>
			<text class="voice-entry-text">{{ isRecording ? '正在听，请说话…' : (isUnderstanding ? '正在理解指令…' : '点击开始说话') }}</text>
		</view>

		<BottomNav current="" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { parseAssistantCommand, recognizeAudioByUpload, synthesizeAssistantSpeech } from '@/api/modules/ai'
import { createIngredientsBatch, consumeIngredientsBatch, getIngredientList } from '@/api/modules/ingredients'
import { createRecipeTask } from '@/api/modules/recipes'
import { playSpeechAudio } from '@/utils/speech-audio'
import { getShelfLifeSettings } from '@/api/modules/shelf-life'
import { getCurrentUserId } from '@/utils/current-user'
import { DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY, getShelfLifeDays, normalizeShelfLifeDaysByCategory } from '@/utils/shelf-life'

export default {
	components: { BottomNav },
	data() {
		return {
			safeTop: 20,
			recorderManager: null,
			isRecording: false,
			isUnderstanding: false,
			isSubmitting: false,
			isGeneratingRecipe: false,
			isSynthesizing: false,
			isSpeaking: false,
			transcript: '',
			manualText: '',
			command: null,
			actionStatus: '',
			actionMessage: '',
			pendingItems: [],
			pendingConsumeItems: [],
			inventoryResult: [],
			expiryResult: [],
			audioContext: null,
			userId: getCurrentUserId(),
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			units: ['份', '盒', '罐', '包', '个', '颗', '条', '片', '根', '瓶', '袋', '块', '毫升', '升', '千克', '克', '斤', '公斤', '把', '只'],
			locations: ['冷藏', '冷冻'],
			shelfLifeDaysByCategory: { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY },
			examples: [
				'买了3个番茄放冷藏',
				'今天用了2个鸡蛋',
				'冰箱里还有什么',
				'有什么食材快过期',
				'用番茄推荐一道20分钟的菜'
			]
		}
	},
	computed: {
		intentLabel() {
			const labels = {
				inventory_add: '准备入库',
				inventory_consume: '准备出库',
				inventory_read: '查询库存',
				expiry_read: '查询临期',
				recipe_request: '菜谱请求',
				unknown: '需要确认'
			}
			return labels[this.command?.intent] || '需要确认'
		},
		intentTone() {
			if (this.command?.intent === 'inventory_add') return 'green'
			if (this.command?.intent === 'inventory_consume') return 'orange'
			if (this.command?.intent === 'unknown') return 'gray'
			return 'blue'
		},
		isPendingInventoryAdd() {
			return this.command?.intent === 'inventory_add' && this.pendingItems.length > 0 && !this.actionStatus
		},
		canConfirmInventoryAdd() {
			if (this.isSubmitting || !this.isPendingInventoryAdd) return false
			return this.pendingItems.every((item) => {
				const quantity = Number(item?.quantity)
				return !!item?.name && !!item?.category && !!item?.unit && !!item?.location &&
					!!item?.expireDate && Number.isFinite(quantity) && quantity > 0
			})
		},
		isPendingInventoryConsume() {
			return this.command?.intent === 'inventory_consume' && this.pendingConsumeItems.length > 0 && !this.actionStatus
		},
		canConfirmInventoryConsume() {
			if (this.isSubmitting || !this.isPendingInventoryConsume) return false
			return this.pendingConsumeItems.every((item) => {
				const quantity = Number(item?.quantity)
				return Number.isFinite(quantity) && quantity > 0 && quantity <= Number(item?.available || 0)
			})
		},
		canSpeakCurrentResult() {
			return ['inventory_read', 'expiry_read'].includes(this.command?.intent) &&
				!!`${this.command?.reply || ''}`.trim()
		},
		recipeSummary() {
			if (this.command?.intent !== 'recipe_request') return ''
			const recipe = this.command?.recipe || {}
			const parts = []
			if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) parts.push(`食材：${recipe.ingredients.join('、')}`)
			if (recipe.maxDuration) parts.push(`${recipe.maxDuration}分钟内`)
			if (recipe.difficulty) parts.push(recipe.difficulty)
			if (recipe.taste) parts.push(recipe.taste)
			return parts.join(' · ') || '未指定额外条件'
		},
		safetyNote() {
			if (this.command?.intent === 'inventory_read') return '以上结果来自你当前的真实库存'
			if (this.command?.intent === 'expiry_read') return '临期结果按当前库存的预计过期日期计算'
			if (this.command?.requiresConfirmation) return '确认无误后才会执行，取消不会修改库存'
			return '当前先完成指令理解，后续将继续接入实际功能'
		}
	},
	onLoad() {
		try {
			const info = uni.getSystemInfoSync()
			const top = Number(info?.statusBarHeight || 0)
			if (Number.isFinite(top) && top > 0) this.safeTop = top
		} catch (_) {}
		this.initRecorder()
		this.initAudioPlayer()
		this.loadShelfLifeSettings()
	},
	onUnload() {
		if (this.isRecording && this.recorderManager) this.recorderManager.stop()
		if (this.audioContext) {
			this.audioContext.stop()
			this.audioContext.destroy()
		}
	},
	methods: {
		async loadShelfLifeSettings() {
			try {
				const res = await getShelfLifeSettings(this.userId)
				const rules = res?.rules || res?.data?.rules || {}
				this.shelfLifeDaysByCategory = normalizeShelfLifeDaysByCategory(rules)
			} catch (_) {
				this.shelfLifeDaysByCategory = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
			}
		},
		resetActionState() {
			this.pendingItems = []
			this.pendingConsumeItems = []
			this.inventoryResult = []
			this.expiryResult = []
			this.actionStatus = ''
			this.actionMessage = ''
			this.isSubmitting = false
			this.isGeneratingRecipe = false
		},
		prepareCommand(command) {
			this.resetActionState()
			if (command?.intent !== 'inventory_add') return
			const sourceItems = Array.isArray(command?.items) ? command.items : []
			this.pendingItems = sourceItems
				.map((item) => {
					const name = `${item?.name || ''}`.trim()
					const category = this.categories.includes(item?.category)
						? item.category
						: this.inferCategoryByName(name)
					const unit = this.units.includes(item?.unit)
						? item.unit
						: this.inferUnitByName(name, category)
					const location = this.normalizeLocation(item?.location)
					const quantity = Number(item?.quantity)
					return {
						name,
						category,
						quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
						unit,
						location,
						expireDate: this.normalizeExpireDate(item?.expireDate, category)
					}
				})
				.filter((item) => !!item.name)
		},
		inferCategoryByName(name) {
			const text = `${name || ''}`
			if (/(苹果|香蕉|橙|梨|桃|葡萄|莓|西瓜|哈密瓜|柚|柠檬|樱桃|芒果|菠萝|榴莲)/.test(text)) return '水果'
			if (/(菜|葱|姜|蒜|椒|茄|瓜|萝卜|土豆|西兰花|蘑菇|菌|豆角|白菜|生菜|菠菜|芹菜|番茄)/.test(text)) return '蔬菜'
			if (/(牛肉|猪肉|羊肉|鸡肉|鸭肉|排骨|里脊|肉馅|火腿|培根)/.test(text)) return '肉类'
			if (/(蛋|牛奶|酸奶|芝士|黄油|奶酪|奶油)/.test(text)) return '蛋奶'
			if (/(虾|鱼|蟹|贝|蛤|鱿鱼|海参|海带)/.test(text)) return '海鲜'
			if (/(可乐|雪碧|果汁|饮料|矿泉水|纯净水|茶饮|咖啡)/.test(text)) return '饮料'
			if (/(酱|醋|盐|糖|料酒|生抽|老抽|蚝油|胡椒|孜然)/.test(text)) return '调味品'
			return '其他'
		},
		inferUnitByName(name, category) {
			const text = `${name || ''}`
			if (/(牛奶|酸奶|饮料|果汁|可乐|雪碧|豆浆|啤酒|矿泉水|椰汁)/.test(text)) return '毫升'
			if (/(牛肉|猪肉|鸡胸|鸡肉|排骨|肉馅|虾仁|鱼片)/.test(text)) return '克'
			if (/(鸡蛋|鹌鹑蛋)/.test(text)) return '颗'
			if (/(面条|米线|粉丝)/.test(text)) return '包'
			if (/(豆腐|年糕)/.test(text)) return '块'
			if (category === '肉类') return '克'
			if (category === '饮料') return '毫升'
			return '个'
		},
		normalizeLocation(value) {
			const text = `${value || ''}`
			if (text.includes('冷冻') || text.includes('冻')) return '冷冻'
			return '冷藏'
		},
		getExpireDateByCategory(category) {
			const days = getShelfLifeDays(category, this.shelfLifeDaysByCategory)
			const date = new Date()
			date.setHours(0, 0, 0, 0)
			date.setDate(date.getDate() + days)
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			return `${y}-${m}-${d}`
		},
		normalizeExpireDate(value, category) {
			const text = `${value || ''}`.slice(0, 10)
			const today = new Date().toISOString().slice(0, 10)
			if (/^\d{4}-\d{2}-\d{2}$/.test(text) && text >= today) return text
			return this.getExpireDateByCategory(category)
		},
		getOptionIndex(options, value) {
			const index = options.indexOf(value)
			return index >= 0 ? index : 0
		},
		onPendingUnitChange(index, event) {
			this.pendingItems[index].unit = this.units[event?.detail?.value] || this.pendingItems[index].unit
		},
		onPendingCategoryChange(index, event) {
			const category = this.categories[event?.detail?.value] || '其他'
			this.pendingItems[index].category = category
			this.pendingItems[index].expireDate = this.getExpireDateByCategory(category)
		},
		onPendingLocationChange(index, event) {
			this.pendingItems[index].location = this.locations[event?.detail?.value] || '冷藏'
		},
		onPendingExpireDateChange(index, event) {
			const value = `${event?.detail?.value || ''}`
			const today = new Date().toISOString().slice(0, 10)
			if (!value || value < today) {
				uni.showToast({ title: '过期日期不能早于今天', icon: 'none' })
				return
			}
			this.pendingItems[index].expireDate = value
		},
		cancelInventoryAdd() {
			if (this.isSubmitting) return
			this.actionStatus = 'cancelled'
			this.actionMessage = '好的，已取消这次入库，没有修改库存。'
		},
		async confirmInventoryAdd() {
			if (!this.canConfirmInventoryAdd) {
				uni.showToast({ title: '请先补全入库信息', icon: 'none' })
				return
			}
			this.isSubmitting = true
			uni.showLoading({ title: '正在入库…' })
			try {
				const items = this.pendingItems.map((item) => ({
					name: `${item.name || ''}`.trim(),
					category: item.category,
					quantity: Number(item.quantity),
					unit: item.unit,
					location: item.location,
					expireDate: item.expireDate
				}))
				await createIngredientsBatch(items)
				const summary = items
					.map((item) => `${item.name}${item.quantity}${item.unit}`)
					.join('、')
				this.actionStatus = 'success'
				this.actionMessage = `已成功入库：${summary}。`
				uni.showToast({ title: '入库成功', icon: 'success' })
			} catch (error) {
				this.actionStatus = 'failed'
				this.actionMessage = `${error?.message || '入库失败，请检查信息后重试。'}`
				uni.showToast({ title: '入库失败', icon: 'none' })
			} finally {
				this.isSubmitting = false
				uni.hideLoading()
			}
		},
		initAudioPlayer() {
			if (typeof uni.createInnerAudioContext !== 'function') return
			const audio = uni.createInnerAudioContext()
			audio.autoplay = false
			audio.onPlay(() => {
				this.isSpeaking = true
			})
			audio.onEnded(() => {
				this.isSpeaking = false
			})
			audio.onStop(() => {
				this.isSpeaking = false
			})
			audio.onError((error) => {
				console.error('语音助手播放失败', error)
				this.isSpeaking = false
				this.isSynthesizing = false
				uni.showToast({ title: '语音播放失败，请重试', icon: 'none' })
			})
			this.audioContext = audio
		},
		extractIngredientList(res) {
			if (Array.isArray(res)) return res
			if (Array.isArray(res?.data)) return res.data
			if (Array.isArray(res?.data?.data)) return res.data.data
			return []
		},
		normalizeIngredientName(value) {
			return `${value || ''}`
				.trim()
				.toLowerCase()
				.replace(/\s+/g, '')
				.replace(/西红柿/g, '番茄')
				.replace(/土豆/g, '马铃薯')
		},
		getInventoryQuery() {
			const transcript = `${this.command?.transcript || this.transcript || ''}`
			const rawTarget = `${this.command?.query?.target || ''}`
				.replace(/^(冰箱里|库存里|冰箱|库存|冷藏区|冷冻区)/, '')
				.replace(/(还有多少|还剩多少|剩多少|有多少|还有几个|还剩几个|有哪些|有什么)$/g, '')
				.trim()
			const genericTargets = ['食材', '东西', '库存', '冰箱', '冷藏', '冷冻']
			return {
				target: genericTargets.includes(rawTarget) ? '' : rawTarget,
				location: `${this.command?.query?.location || ''}`.includes('冷冻') || transcript.includes('冷冻')
					? '冷冻'
					: (`${this.command?.query?.location || ''}`.includes('冷藏') || transcript.includes('冷藏') ? '冷藏' : '')
			}
		},
		aggregateInventory(list) {
			const result = new Map()
			list.forEach((source) => {
				const name = `${source?.name || ''}`.trim()
				const unit = `${source?.unit || ''}`.trim()
				const quantity = Number(source?.quantity)
				if (!name || !Number.isFinite(quantity) || quantity <= 0) return
				const key = `${this.normalizeIngredientName(name)}|${unit}`
				const current = result.get(key) || {
					name,
					unit,
					quantity: 0,
					locations: []
				}
				current.quantity += quantity
				const location = `${source?.location || ''}`.trim()
				if (location && !current.locations.includes(location)) current.locations.push(location)
				result.set(key, current)
			})
			return [...result.values()]
		},
		formatQuantity(value) {
			const quantity = Number(value)
			if (!Number.isFinite(quantity)) return '0'
			return Number.isInteger(quantity) ? `${quantity}` : `${Number(quantity.toFixed(2))}`
		},
		async loadInventoryQuery() {
			const query = this.getInventoryQuery()
			try {
				const res = await getIngredientList()
				let list = this.extractIngredientList(res)
				if (query.location) {
					list = list.filter((item) => `${item?.location || ''}` === query.location)
				}
				if (query.target) {
					const target = this.normalizeIngredientName(query.target)
					list = list.filter((item) => {
						const name = this.normalizeIngredientName(item?.name)
						return name === target || name.includes(target) || target.includes(name)
					})
				}
				this.inventoryResult = this.aggregateInventory(list)
				if (!this.inventoryResult.length) {
					const condition = query.target || (query.location ? `${query.location}区` : '冰箱')
					this.command.reply = `目前没有找到${condition}的库存。`
					await this.autoSpeakIfRequested()
					return
				}
				if (query.target) {
					const amounts = this.inventoryResult
						.map((item) => `${this.formatQuantity(item.quantity)}${item.unit}`)
						.join('、')
					this.command.reply = `${query.target}目前共有${amounts}。`
					await this.autoSpeakIfRequested()
					return
				}
				const scope = query.location ? `${query.location}区` : '冰箱里'
				this.command.reply = `${scope}目前共有${this.inventoryResult.length}种食材：`
				await this.autoSpeakIfRequested()
			} catch (error) {
				this.inventoryResult = []
				this.command.reply = `${error?.message || '库存读取失败，请稍后重试。'}`
			}
		},
		getDaysLeft(expireDate) {
			const date = new Date(expireDate)
			if (!Number.isFinite(date.getTime())) return Number.POSITIVE_INFINITY
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			date.setHours(0, 0, 0, 0)
			return Math.ceil((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000))
		},
		formatExpireDate(value) {
			const date = new Date(value)
			if (!Number.isFinite(date.getTime())) return '日期未知'
			const month = `${date.getMonth() + 1}`.padStart(2, '0')
			const day = `${date.getDate()}`.padStart(2, '0')
			return `${month}月${day}日`
		},
		formatDaysLeft(days) {
			if (days < 0) return `已过期${Math.abs(days)}天`
			if (days === 0) return '今天到期'
			return `还剩${days}天`
		},
		async loadExpiryQuery() {
			try {
				const res = await getIngredientList()
				const target = this.normalizeIngredientName(this.command?.query?.target)
				this.expiryResult = this.extractIngredientList(res)
					.map((item) => ({ ...item, daysLeft: this.getDaysLeft(item?.expireDate) }))
					.filter((item) => Number.isFinite(item.daysLeft) && item.daysLeft <= 3)
					.filter((item) => {
						if (!target) return true
						const name = this.normalizeIngredientName(item?.name)
						return name === target || name.includes(target) || target.includes(name)
					})
					.sort((a, b) => a.daysLeft - b.daysLeft)
				if (!this.expiryResult.length) {
					this.command.reply = target
						? `目前没有找到${this.command?.query?.target}的临期或过期库存。`
						: '目前没有3天内到期或已经过期的食材。'
				} else {
					const expiredCount = this.expiryResult.filter((item) => item.daysLeft < 0).length
					this.command.reply = `发现${this.expiryResult.length}项需要留意的食材${expiredCount ? `，其中${expiredCount}项已过期` : ''}：`
				}
				await this.autoSpeakIfRequested()
			} catch (error) {
				this.expiryResult = []
				this.command.reply = `${error?.message || '临期库存读取失败，请稍后重试。'}`
			}
		},
		findInventoryMatches(list, name) {
			const target = this.normalizeIngredientName(name)
			return list.filter((item) => {
				const current = this.normalizeIngredientName(item?.name)
				return current === target || current.includes(target) || target.includes(current)
			})
		},
		isEquivalentUnit(left, right) {
			const a = `${left || ''}`.trim()
			const b = `${right || ''}`.trim()
			if (!a || !b || a === b) return true
			const countUnits = ['个', '颗', '只', '枚']
			return countUnits.includes(a) && countUnits.includes(b)
		},
		async prepareInventoryConsume() {
			try {
				const res = await getIngredientList()
				const list = this.extractIngredientList(res)
				const requests = Array.isArray(this.command?.items) ? this.command.items : []
				this.pendingConsumeItems = requests.map((request) => {
					const matches = this.findInventoryMatches(list, request?.name)
						.sort((a, b) => {
							const left = new Date(a?.expireDate).getTime()
							const right = new Date(b?.expireDate).getTime()
							return (Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER) -
								(Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER)
					})
					const requestedUnit = `${request?.unit || ''}`.trim()
					const compatibleMatches = requestedUnit
						? matches.filter((item) => this.isEquivalentUnit(item?.unit, requestedUnit))
						: matches
					const unit = `${compatibleMatches[0]?.unit || requestedUnit || ''}`.trim()
					const sources = compatibleMatches
						.map((item) => ({
							id: Number(item.id),
							quantity: Number(item.quantity || 0)
						}))
						.filter((item) => item.id > 0 && item.quantity > 0)
					const available = sources.reduce((sum, item) => sum + item.quantity, 0)
					const quantity = Number(request?.quantity)
					return {
						name: `${request?.name || ''}`.trim(),
						unit,
						quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
						available,
						sources
					}
				}).filter((item) => item.name)
				const missing = this.pendingConsumeItems.filter((item) => !item.available)
				if (!this.pendingConsumeItems.length) {
					this.actionStatus = 'failed'
					this.actionMessage = '没有识别到要出库的食材，请说清楚食材名称和数量。'
				} else if (missing.length) {
					this.actionStatus = 'failed'
					this.actionMessage = `库存中没有找到：${missing.map((item) => item.name).join('、')}。`
					this.pendingConsumeItems = []
				}
			} catch (error) {
				this.actionStatus = 'failed'
				this.actionMessage = `${error?.message || '库存读取失败，请稍后重试。'}`
			}
		},
		changeConsumeQuantity(index, delta) {
			const item = this.pendingConsumeItems[index]
			if (!item) return
			const current = Number(item.quantity || 0)
			const next = Math.max(1, Math.min(Number(item.available || 1), current + delta))
			item.quantity = Number.isInteger(next) ? next : Number(next.toFixed(2))
		},
		cancelInventoryConsume() {
			if (this.isSubmitting) return
			this.actionStatus = 'cancelled'
			this.actionMessage = '好的，已取消这次出库，没有修改库存。'
		},
		buildConsumeAllocations() {
			const allocations = []
			this.pendingConsumeItems.forEach((item) => {
				let remaining = Number(item.quantity)
				item.sources.forEach((source) => {
					if (remaining <= 0) return
					const quantity = Math.min(remaining, Number(source.quantity || 0))
					if (quantity > 0) allocations.push({ id: source.id, quantity })
					remaining -= quantity
				})
			})
			return allocations
		},
		async confirmInventoryConsume() {
			if (!this.canConfirmInventoryConsume) {
				uni.showToast({ title: '请检查出库数量', icon: 'none' })
				return
			}
			this.isSubmitting = true
			uni.showLoading({ title: '正在出库…' })
			try {
				await consumeIngredientsBatch(this.buildConsumeAllocations())
				const summary = this.pendingConsumeItems
					.map((item) => `${item.name}${this.formatQuantity(item.quantity)}${item.unit}`)
					.join('、')
				this.actionStatus = 'success'
				this.actionMessage = `已成功出库：${summary}。`
				uni.showToast({ title: '出库成功', icon: 'success' })
			} catch (error) {
				this.actionStatus = 'failed'
				this.actionMessage = `${error?.message || '出库失败，请稍后重试。'}`
				uni.showToast({ title: '出库失败', icon: 'none' })
			} finally {
				this.isSubmitting = false
				uni.hideLoading()
			}
		},
		normalizeRecipeIngredients(list) {
			return (Array.isArray(list) ? list : [])
				.filter((item) => item?.name)
				.map((item) => ({
					name: `${item.name}`.trim(),
					quantity: Number(item.quantity || 1),
					unit: `${item.unit || ''}`.trim()
				}))
		},
		openRecipeResultPage(taskId) {
			const targetUrl = `/pages/recipe/result?taskId=${encodeURIComponent(taskId)}`
			const pages = getCurrentPages()
			if (Array.isArray(pages) && pages.length >= 9) {
				uni.redirectTo({ url: targetUrl })
				return
			}
			uni.navigateTo({
				url: targetUrl,
				fail: () => uni.redirectTo({ url: targetUrl })
			})
		},
		async startRecipeRequest() {
			if (this.isGeneratingRecipe) return
			this.isGeneratingRecipe = true
			uni.showLoading({ title: '正在准备菜谱…' })
			try {
				const listRes = await getIngredientList()
				const pantry = this.normalizeRecipeIngredients(this.extractIngredientList(listRes))
				const requestedNames = Array.isArray(this.command?.recipe?.ingredients)
					? this.command.recipe.ingredients.map((name) => `${name || ''}`.trim()).filter(Boolean)
					: []
				let ingredients = pantry
				if (requestedNames.length) {
					ingredients = requestedNames.map((name) => {
						const match = this.findInventoryMatches(pantry, name)[0]
						return match || { name, quantity: 1, unit: '' }
					})
				}
				if (!ingredients.length) throw new Error('冰箱暂无可用于推荐的食材')
				const taskRes = await createRecipeTask({
					userId: this.userId,
					ingredients,
					tastePreference: this.command?.recipe?.taste || '家常',
					cookingTime: Number(this.command?.recipe?.maxDuration || 30),
					difficulty: this.command?.recipe?.difficulty || undefined,
					count: 6
				})
				const taskId = `${taskRes?.data?.taskId || taskRes?.taskId || ''}`.trim()
				if (!taskId) throw new Error('创建菜谱任务失败')
				const batchId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
				uni.setStorageSync('latestGeneratedRecipes', [])
				uni.setStorageSync('latestGeneratedBatchId', batchId)
				uni.setStorageSync('latestRecipeProfileApplied', null)
				uni.setStorageSync('latestPantryTags', ingredients.slice(0, 6).map((item) => item.name))
				uni.setStorageSync('latestPantryIngredients', ingredients)
				this.command.reply = '已经开始生成菜谱，正在为你打开推荐结果。'
				this.openRecipeResultPage(taskId)
			} catch (error) {
				this.command.reply = `${error?.message || '菜谱推荐失败，请稍后重试。'}`
				uni.showToast({ title: '菜谱推荐失败', icon: 'none' })
			} finally {
				this.isGeneratingRecipe = false
				uni.hideLoading()
			}
		},
		buildSpeechText() {
			const parts = [`${this.command?.reply || ''}`.trim()]
			if (this.command?.intent === 'inventory_read') {
				this.inventoryResult.forEach((item) => {
					parts.push(`${item.name}${this.formatQuantity(item.quantity)}${item.unit}，${item.locations.join('和')}`)
				})
			}
			if (this.command?.intent === 'expiry_read') {
				this.expiryResult.forEach((item) => {
					parts.push(`${item.name}，${this.formatDaysLeft(item.daysLeft)}`)
				})
			}
			return parts.filter(Boolean).join('。').slice(0, 600)
		},
		async autoSpeakIfRequested() {
			const transcript = `${this.command?.transcript || this.transcript || ''}`
			if (/(朗读|读一下|念一下|说一下)/.test(transcript)) {
				await this.speakCurrentResult()
			}
		},
		async speakCurrentResult() {
			if (this.isSynthesizing) return
			if (this.isSpeaking && this.audioContext) {
				this.audioContext.stop()
				return
			}
			if (!this.audioContext) {
				uni.showToast({ title: '当前环境不支持语音播放', icon: 'none' })
				return
			}
			const text = this.buildSpeechText()
			if (!text) return
			this.isSynthesizing = true
			try {
				const res = await synthesizeAssistantSpeech(text)
				const audioPath = `${res?.data?.audioPath || res?.audioPath || ''}`.trim()
				if (!audioPath) throw new Error('没有生成朗读音频')
				await playSpeechAudio(this.audioContext, audioPath)
			} catch (error) {
				console.error('语音助手朗读失败', error)
				uni.showToast({ title: `${error?.message || '朗读失败，请重试'}`, icon: 'none' })
			} finally {
				this.isSynthesizing = false
			}
		},
		initRecorder() {
			if (typeof uni.getRecorderManager !== 'function') return
			const manager = uni.getRecorderManager()
			if (!manager || typeof manager.start !== 'function') return
			manager.onStop((res) => this.handleRecordStop(res))
			manager.onError(() => {
				this.isRecording = false
				this.isUnderstanding = false
				uni.hideLoading()
				uni.showToast({ title: '录音失败，请重试', icon: 'none' })
			})
			this.recorderManager = manager
		},
		toggleRecording() {
			if (this.isUnderstanding) return
			if (!this.recorderManager) {
				uni.showToast({ title: '当前环境不支持录音', icon: 'none' })
				return
			}
			if (this.isRecording) {
				this.isUnderstanding = true
				uni.showLoading({ title: '正在理解…' })
				this.recorderManager.stop()
				return
			}
			this.command = null
			this.resetActionState()
			this.isRecording = true
			this.recorderManager.start({
				duration: 20000,
				sampleRate: 16000,
				numberOfChannels: 1,
				encodeBitRate: 96000,
				format: 'mp3'
			})
		},
		async handleRecordStop(res) {
			this.isRecording = false
			const filePath = res?.tempFilePath
			if (!filePath) {
				this.isUnderstanding = false
				uni.hideLoading()
				uni.showToast({ title: '没有录到声音', icon: 'none' })
				return
			}
			try {
				const recognized = await recognizeAudioByUpload(filePath)
				const text = `${recognized?.data?.text || ''}`.trim()
				if (!text) throw new Error('没有识别到语音内容')
				this.transcript = text
				this.manualText = text
				await this.parseText(text)
			} catch (error) {
				const message = `${error?.message || error?.errMsg || ''}`.trim()
				uni.showToast({ title: message || '语音理解失败，请重试', icon: 'none' })
			} finally {
				this.isUnderstanding = false
				uni.hideLoading()
			}
		},
		async parseText(text) {
			const value = `${text || ''}`.trim()
			if (!value) return
			this.isUnderstanding = true
			const result = await parseAssistantCommand(value)
			this.command = result?.data?.command || null
			this.prepareCommand(this.command)
			this.transcript = value
			if (this.command?.intent === 'inventory_read') await this.loadInventoryQuery()
			if (this.command?.intent === 'inventory_consume') await this.prepareInventoryConsume()
			if (this.command?.intent === 'expiry_read') await this.loadExpiryQuery()
			if (this.command?.intent === 'recipe_request') await this.startRecipeRequest()
		},
		async parseManualText() {
			if (this.isUnderstanding) return
			const value = `${this.manualText || ''}`.trim()
			if (!value) return
			uni.showLoading({ title: '正在理解…' })
			try {
				await this.parseText(value)
			} catch (error) {
				uni.showToast({ title: `${error?.message || '指令解析失败'}`, icon: 'none' })
			} finally {
				this.isUnderstanding = false
				uni.hideLoading()
			}
		},
		tryExample(example) {
			this.manualText = example
			this.parseManualText()
		},
		formatItemMeta(item) {
			const parts = []
			if (item?.quantity) parts.push(`${item.quantity}${item.unit || ''}`)
			if (item?.category) parts.push(item.category)
			if (item?.location) parts.push(item.location)
			if (item?.expireDate) parts.push(item.expireDate)
			return parts.join(' · ') || '信息待补充'
		},
		goBack() {
			const pages = getCurrentPages()
			if (Array.isArray(pages) && pages.length > 1) {
				uni.navigateBack()
				return
			}
			uni.reLaunch({ url: '/pages/home/index' })
		}
	}
}
</script>

<style scoped>
.container {
	min-height: 100vh;
	padding: 0 14px 176px;
	background: #f4f6f5;
}
.top { display: flex; align-items: center; gap: 8rpx; margin-bottom: 18rpx; }
.back { width: 30px; height: 34px; display: flex; align-items: center; justify-content: center; }
.back-arrow { color: #b7c1ba; font-size: 30px; line-height: 1; }
.top-title { color: #202c29; font-size: 20px; font-weight: 800; }
.chat-row { display: flex; align-items: flex-start; gap: 12rpx; }
.assistant-row { justify-content: flex-start; }
.user-row { justify-content: flex-end; margin-top: 24rpx; }
.chat-avatar { width: 116rpx; height: 116rpx; overflow: hidden; flex-shrink: 0; }
.chat-avatar.small { width: 84rpx; height: 84rpx; }
.chat-avatar-image { width: 100%; height: 100%; transform: scale(1.72); }
.assistant-bubble { position: relative; max-width: 520rpx; padding: 20rpx 22rpx; border: 1rpx solid #dfe8e3; border-radius: 7px 18px 18px 18px; background: #fff; box-shadow: 0 7rpx 18rpx rgba(30, 50, 34, .055); }
.assistant-bubble::before { content: ''; position: absolute; left: -10rpx; top: 22rpx; width: 18rpx; height: 18rpx; border-left: 1rpx solid #dfe8e3; border-bottom: 1rpx solid #dfe8e3; background: #fff; transform: rotate(45deg); }
.welcome-bubble { margin-top: 8rpx; }
.welcome-title { display: block; color: #26352d; font-size: 15px; font-weight: 800; }
.welcome-text { display: block; margin-top: 8rpx; color: #738177; font-size: 10px; line-height: 1.6; }
.examples { margin-top: 24rpx; }
.section-title { display: block; margin: 0 4rpx 12rpx; color: #354039; font-size: 14px; font-weight: 800; }
.example-list { display: flex; flex-wrap: wrap; gap: 9rpx; }
.example-chip { padding: 10rpx 14rpx; border: 1rpx solid #d7e5dc; border-radius: 999rpx; color: #65746b; background: #f8fcf9; font-size: 10px; }
.conversation { margin-top: 6rpx; }
.user-bubble { max-width: 500rpx; padding: 16rpx 20rpx; border-radius: 18px 7px 18px 18px; color: #385b91; background: #e8f0ff; font-size: 11px; line-height: 1.6; }
.result-row { margin-top: 14rpx; }
.result-bubble { flex: 1; max-width: 540rpx; }
.result-head { display: flex; align-items: center; margin-bottom: 10rpx; }
.assistant-reply { position: relative; z-index: 1; display: block; color: #33423a; font-size: 11px; line-height: 1.65; }
.inventory-result { position: relative; z-index: 1; margin-top: 12rpx; overflow: hidden; border: 1rpx solid #e1ebe5; border-radius: 12px; background: #f8fbf9; }
.inventory-result-row { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; padding: 14rpx 16rpx; border-bottom: 1rpx solid #e8efeb; }
.inventory-result-row:last-child { border-bottom: 0; }
.inventory-result-main { min-width: 0; }
.inventory-result-name { display: block; color: #314037; font-size: 11px; font-weight: 700; }
.inventory-result-location { display: block; margin-top: 4rpx; color: #94a099; font-size: 8px; }
.inventory-result-amount { flex-shrink: 0; color: #4d9e59; font-size: 11px; font-weight: 800; }
.expiry-days { flex-shrink: 0; padding: 5rpx 9rpx; border-radius: 999rpx; color: #b66b31; background: #fff0e2; font-size: 9px; font-weight: 700; }
.expiry-days.expired { color: #bd554b; background: #fdeceb; }
.intent-pill { flex-shrink: 0; padding: 6rpx 12rpx; border-radius: 999rpx; font-size: 9px; font-weight: 700; }
.intent-pill.green { color: #438d50; background: #eaf6ec; }
.intent-pill.orange { color: #b76e35; background: #fff1e4; }
.intent-pill.blue { color: #527db3; background: #edf4fc; }
.intent-pill.gray { color: #7c8680; background: #f0f2f1; }
.confirm-card { position: relative; z-index: 1; margin-top: 16rpx; }
.confirm-item { padding: 14rpx; border: 1rpx solid #dce8e0; border-radius: 13px; background: #f8fbf9; }
.confirm-item + .confirm-item { margin-top: 10rpx; }
.confirm-item-head { display: grid; grid-template-columns: 32rpx 1fr; align-items: center; gap: 8rpx; }
.confirm-index { width: 30rpx; height: 30rpx; display: flex; align-items: center; justify-content: center; border-radius: 50%; color: #4e9a5a; background: #e7f5e9; font-size: 9px; font-weight: 700; }
.confirm-name { height: 50rpx; padding: 0 10rpx; border: 1rpx solid #dce7df; border-radius: 9px; color: #2d3b33; background: #fff; font-size: 12px; font-weight: 700; }
.confirm-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; margin-top: 10rpx; }
.confirm-field { min-height: 62rpx; padding: 8rpx 10rpx; border: 1rpx solid #e2eae5; border-radius: 9px; background: #fff; }
.confirm-label { display: block; color: #95a199; font-size: 8px; }
.confirm-value { display: block; margin-top: 5rpx; color: #526159; font-size: 10px; font-weight: 700; }
.confirm-input { height: 30rpx; margin-top: 2rpx; color: #526159; font-size: 10px; font-weight: 700; }
.expire-field { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8rpx; min-height: 54rpx; margin-top: 8rpx; padding: 0 10rpx; border: 1rpx solid #e2eae5; border-radius: 9px; background: #fff; }
.expire-value { color: #526159; font-size: 10px; text-align: right; }
.picker-arrow { color: #a4b0a9; font-size: 16px; }
.confirm-actions { display: grid; grid-template-columns: 1fr 1.5fr; gap: 9rpx; margin-top: 12rpx; }
.cancel-btn,.confirm-btn { height: 62rpx; line-height: 62rpx; margin: 0; padding: 0; border-radius: 11px; font-size: 10px; font-weight: 700; }
.cancel-btn { color: #748078; background: #eef2ef; }
.confirm-btn { color: #fff; background: #55b660; }
.consume-confirm-btn { height: 62rpx; line-height: 62rpx; margin: 0; padding: 0; border-radius: 11px; color: #fff; background: #ef9b45; font-size: 10px; font-weight: 700; }
.cancel-btn::after,.confirm-btn::after,.consume-confirm-btn::after { border: 0; }
.confirm-btn[disabled] { color: #aab4ac; background: #edf1ee; }
.consume-confirm-btn[disabled] { color: #b5aea8; background: #f2eeea; }
.consume-item-head { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; }
.consume-name { display: block; color: #344139; font-size: 11px; font-weight: 800; }
.consume-stock { display: block; margin-top: 5rpx; color: #929e96; font-size: 8px; }
.consume-quantity { display: flex; align-items: center; flex-shrink: 0; overflow: hidden; border: 1rpx solid #eadfd6; border-radius: 10px; background: #fff; }
.consume-step { width: 44rpx; height: 46rpx; display: flex; align-items: center; justify-content: center; color: #ce7d38; font-size: 14px; }
.consume-input { width: 58rpx; height: 46rpx; color: #3c4841; font-size: 11px; font-weight: 700; text-align: center; }
.field-label { display: block; color: #929c95; font-size: 9px; font-weight: 700; }
.command-section { margin-top: 16rpx; }
.item-list { margin-top: 8rpx; border: 1rpx solid #edf2ee; border-radius: 12px; overflow: hidden; }
.item-row { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; padding: 13rpx 14rpx; border-bottom: 1rpx solid #edf2ee; }
.item-row:last-child { border-bottom: 0; }
.item-name { color: #354039; font-size: 11px; font-weight: 700; }
.item-meta { color: #7e8981; font-size: 9px; text-align: right; }
.summary-text { display: block; margin-top: 8rpx; color: #59665e; font-size: 10px; line-height: 1.6; }
.safety-note { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; padding-top: 12rpx; border-top: 1rpx solid #edf2ee; color: #95a098; font-size: 9px; }
.safety-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #75bf7e; flex-shrink: 0; }
.speak-action { position: relative; z-index: 1; display: inline-flex; align-items: center; gap: 7rpx; margin-top: 12rpx; padding: 8rpx 13rpx; border-radius: 999rpx; color: #527db3; background: #edf4fc; font-size: 9px; font-weight: 700; }
.speak-icon { color: #5d86bd; font-size: 10px; }
.execution-row { margin-top: 14rpx; }
.execution-bubble { padding: 16rpx 18rpx; }
.execution-bubble.success { border-color: #d8eadc; background: #f4fbf5; }
.execution-bubble.cancelled { background: #f7f8f7; }
.execution-bubble.failed { border-color: #f0d9d4; background: #fff7f5; }
.execution-message { position: relative; z-index: 1; color: #405048; font-size: 11px; line-height: 1.6; }
.voice-entry { position: fixed; left: 50%; bottom: 122px; z-index: 20; display: flex; flex-direction: column; align-items: center; gap: 9rpx; transform: translateX(-50%); }
.voice-btn { width: 112rpx; height: 112rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid #d8e5fb; border-radius: 50%; background: #e8f0ff; color: #4a73d9; box-shadow: 0 10rpx 24rpx rgba(74, 115, 217, .16); }
.assistant-iconfont { font-family: "iconfont" !important; font-style: normal; font-weight: 400; line-height: 1; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.voice-ico { color: inherit; font-size: 34px; }
.voice-entry-text { color: #53645b; font-size: 10px; font-weight: 700; white-space: nowrap; }
.voice-entry.recording .voice-btn { color: #fff; background: #4a73d9; animation: pulse 1.15s ease-in-out infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
</style>
