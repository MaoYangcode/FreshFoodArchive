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
						<text>{{ command.requiresConfirmation ? '确认无误后才会执行，本阶段暂不修改库存' : '当前先完成理解，后续接入实际查询与朗读' }}</text>
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
import { parseAssistantCommand, recognizeAudioByUpload } from '@/api/modules/ai'
import { createIngredientsBatch } from '@/api/modules/ingredients'
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
			transcript: '',
			manualText: '',
			command: null,
			actionStatus: '',
			actionMessage: '',
			pendingItems: [],
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
		recipeSummary() {
			if (this.command?.intent !== 'recipe_request') return ''
			const recipe = this.command?.recipe || {}
			const parts = []
			if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) parts.push(`食材：${recipe.ingredients.join('、')}`)
			if (recipe.maxDuration) parts.push(`${recipe.maxDuration}分钟内`)
			if (recipe.difficulty) parts.push(recipe.difficulty)
			if (recipe.taste) parts.push(recipe.taste)
			return parts.join(' · ') || '未指定额外条件'
		}
	},
	onLoad() {
		try {
			const info = uni.getSystemInfoSync()
			const top = Number(info?.statusBarHeight || 0)
			if (Number.isFinite(top) && top > 0) this.safeTop = top
		} catch (_) {}
		this.initRecorder()
		this.loadShelfLifeSettings()
	},
	onUnload() {
		if (this.isRecording && this.recorderManager) this.recorderManager.stop()
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
			this.actionStatus = ''
			this.actionMessage = ''
			this.isSubmitting = false
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
.cancel-btn::after,.confirm-btn::after { border: 0; }
.confirm-btn[disabled] { color: #aab4ac; background: #edf1ee; }
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
