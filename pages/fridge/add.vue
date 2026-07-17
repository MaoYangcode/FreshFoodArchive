<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top" :style="{ paddingRight: `${navRightGap}px` }">
			<text class="top-title">添加食材</text>
		</view>
		<view class="card">
			<view class="head-row">
				<view class="section-title-wrap">
					<text class="ai-iconfont">&#xe620;</text>
					<text class="section-title">AI识别</text>
				</view>
				<text class="ai-tag">AI智能</text>
			</view>
			<view class="recognize-row">
				<view class="recognize-btn" @click="recognizeIngredient">
					<text class="camera ai-iconfont">&#xe694;</text>
					<text class="recognize-title">食材识别</text>
					<text class="recognize-meta">拍照 / 上传食材图片</text>
				</view>
				<view class="recognize-btn receipt" @click="recognizeReceipt">
					<text class="camera ai-iconfont">&#xe693;</text>
					<text class="recognize-title">小票识别</text>
					<text class="recognize-meta">拍照 / 上传购物小票</text>
				</view>
			</view>
		</view>

		<view v-if="batchVisible" class="mask" @click="closeBatchPanel">
			<view class="dialog batch-dialog" @click.stop>
				<view class="batch-head">
					<text class="batch-title">识别结果（{{ batchItems.length }}项）</text>
					<view class="batch-actions">
						<text class="batch-action" @click="toggleBatchSelectAll">{{ batchSelectedCount === batchItems.length ? '取消全选' : '全选' }}</text>
						<text class="batch-action" @click="closeBatchPanel">收起</text>
					</view>
				</view>
				<view class="batch-list">
					<view v-for="(item, idx) in batchItems" :key="idx" class="batch-row">
						<view class="batch-selector" :class="{ on: item.selected }" @click="toggleBatchSelected(idx)">
							<text v-if="item.selected" class="batch-selector-check">✓</text>
						</view>
						<view class="batch-item" :class="{ muted: !item.selected }">
							<view class="batch-line1">
								<input v-model="item.name" class="batch-name" placeholder="食材名称" />
								<view class="batch-stepper">
									<view class="step-btn" @click="decreaseBatchQty(idx)"><view class="step-sign minus-sign"></view></view>
									<text class="step-val">{{ getBatchQuantity(item) }}</text>
									<view class="step-btn" @click="increaseBatchQty(idx)"><view class="step-sign plus-sign"></view></view>
								</view>
								<picker :range="units" @change="onBatchUnitChange(idx, $event)">
									<text class="batch-unit">{{ item.unit || '单位' }}</text>
								</picker>
							</view>
							<view class="batch-line2">
								<picker :range="locations" @change="onBatchLocationChange(idx, $event)">
									<view class="batch-meta">
										<LocationIcon :location="item.location" :size="14" color="#6f9fea" />
										<text class="batch-meta-txt">{{ item.location || '分区' }}</text>
									</view>
								</picker>
								<picker :range="categories" @change="onBatchCategoryChange(idx, $event)">
									<view class="batch-meta">
										<text class="batch-meta-dot">·</text>
										<text class="batch-meta-txt">{{ item.category || '类型' }}</text>
									</view>
								</picker>
								<picker mode="date" :value="item.expireDate" @change="onBatchExpireDateChange(idx, $event)">
									<view class="batch-meta">
										<text class="ai-iconfont batch-meta-ico">&#xe621;</text>
										<text class="batch-meta-txt">{{ item.expireDate || '过期时间' }}</text>
									</view>
								</picker>
							</view>
						</view>
					</view>
				</view>
				<button class="submit-btn batch-submit-btn" :disabled="batchSubmitting" @click="submitBatch">
					{{ batchSubmitting ? '入库中...' : '一键批量入库' }}
				</button>
			</view>
		</view>

		<view class="card form-card">
			<view class="manual-head">
				<text class="ai-iconfont manual-icon">&#xe698;</text>
				<text class="manual-title">手动添加</text>
			</view>
			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◍</text>
					<text class="row-label">食材名称</text>
				</view>
				<input v-model="form.name" class="row-input" placeholder="请输入食材名称" placeholder-style="color:#a5b1aa;" />
				<view class="voice-btn" :class="{ on: isVoiceRecording, disabled: !voiceSupported }" @click="toggleVoiceInput">
					<text class="ai-iconfont voice-ico">&#xe61f;</text>
				</view>
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
				<input v-model="form.quantity" class="qty-input" type="number" placeholder="1" placeholder-style="color:#b4beb8;" />
				<picker :range="units" @change="onUnitChange">
					<view class="row-chip unit-chip">{{ form.unit || '份' }}</view>
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
			<button class="submit-btn" @click="submit">入库</button>
		</view>
		<BottomNav current="add" />
	</view>
</template>

<script>
	
import { createIngredient } from '@/api/modules/ingredients'
import { recognizeAudioByUpload, recognizeIngredientsByUpload, recognizeReceiptByUpload } from '@/api/modules/ai'
import { getShelfLifeSettings } from '@/api/modules/shelf-life'
import BottomNav from '@/components/bottom-nav.vue'
import LocationIcon from '@/components/location-icon.vue'
import { getCurrentUserId } from '@/utils/current-user'
import { DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY, getShelfLifeDays, normalizeShelfLifeDaysByCategory } from '@/utils/shelf-life'

export default {
	components: { BottomNav, LocationIcon },
	data() {
		return {
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			units: [
				'份', '盒', '罐', '包', '个', '条', '片', '根', '瓶', '袋', '块',
				'毫升', '升', '千克', '克', '斤', '公斤', '颗', '组', '把', '只', '杯',
				'支', '粒', '碗', '枚', '盘', '卷', '段', '篮', '捆', '串', '排',
				'桶', '箱', '颗', '朵', '管', '两'
			],
			locations: ['冷藏', '冷冻'],
			userId: getCurrentUserId(),
			shelfLifeDaysByCategory: { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY },
			isVoiceRecording: false,
			voiceSupported: false,
			batchVisible: false,
			batchSubmitting: false,
			batchItems: [],
			form: {
				name: '',
				category: '',
				quantity: '',
				unit: '份',
				location: '',
				expireDate: ''
			},
			recorderManager: null
		}
	},
	computed: {
		batchSelectedCount() {
			return this.batchItems.filter((item) => item.selected !== false).length
		}
	},
	async onShow() {
		this.ensureShareMenu()
		this.userId = getCurrentUserId()
		await this.loadShelfLifeSettings()
	},
	onLoad() {
		this.ensureShareMenu()
		if (typeof uni.getRecorderManager !== 'function') return
		const manager = uni.getRecorderManager()
		if (!manager || typeof manager.onStop !== 'function' || typeof manager.start !== 'function') return
		manager.onStop((res) => {
			this.onVoiceRecordStop(res)
		})
		manager.onError(() => {
			this.isVoiceRecording = false
			uni.hideLoading()
			uni.showToast({ title: '录音失败，请重试', icon: 'none' })
		})
		this.recorderManager = manager
		this.voiceSupported = true
	},
	onUnload() {
		if (this.isVoiceRecording && this.recorderManager) {
			this.recorderManager.stop()
		}
	},
	onShareAppMessage() {
		return {
			title: '我在鲜食档案快速添加食材，库存管理更轻松',
			path: '/pages/fridge/add'
		}
	},
	onShareTimeline() {
		return {
			title: '鲜食档案 | 拍照/语音快速添加食材'
		}
	},
	methods: {
		ensureShareMenu() {
			if (typeof uni === 'undefined' || typeof uni.showShareMenu !== 'function') return
			try {
				uni.showShareMenu({
					menus: ['shareAppMessage', 'shareTimeline']
				})
			} catch (_) {}
		},
		async loadShelfLifeSettings() {
			try {
				const res = await getShelfLifeSettings(this.userId)
				const rules = res?.rules || res?.data?.rules || {}
				this.shelfLifeDaysByCategory = normalizeShelfLifeDaysByCategory(rules)
			} catch (e) {
				this.shelfLifeDaysByCategory = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
			}
		},
		chooseLocalImage() {
			return new Promise((resolve, reject) => {
				uni.chooseImage({
					count: 1,
					sizeType: ['compressed'],
					sourceType: ['camera', 'album'],
					success: (res) => resolve(res),
					fail: (err) => reject(err)
				})
			})
		},
		toggleVoiceInput() {
			if (!this.voiceSupported || !this.recorderManager) {
				uni.showToast({ title: '当前运行环境不支持语音录制', icon: 'none' })
				return
			}
			if (this.isVoiceRecording) {
				this.stopVoiceRecord()
				return
			}
			this.startVoiceRecord()
		},
		startVoiceRecord() {
			if (!this.recorderManager) return
			this.isVoiceRecording = true
			uni.showToast({ title: '开始录音，点“结束”完成', icon: 'none' })
			this.recorderManager.start({
				duration: 15000,
				sampleRate: 16000,
				numberOfChannels: 1,
				encodeBitRate: 96000,
				format: 'mp3'
			})
		},
		stopVoiceRecord() {
			if (!this.recorderManager) return
			uni.showLoading({ title: '语音识别中...' })
			this.recorderManager.stop()
		},
		async onVoiceRecordStop(res) {
			this.isVoiceRecording = false
			const filePath = res?.tempFilePath
			if (!filePath) {
				uni.hideLoading()
				uni.showToast({ title: '录音文件为空', icon: 'none' })
				return
			}
			try {
				const result = await recognizeAudioByUpload(filePath)
				const text = `${result?.data?.text || ''}`.trim()
				const parsedItems = Array.isArray(result?.data?.items) ? result.data.items : []
				const parsedName = `${result?.data?.name || ''}`.trim()
				const parsedQuantity = Number(result?.data?.quantity)
				const parsedUnit = `${result?.data?.unit || ''}`.trim()
				const voiceIntent = this.extractVoiceIntent(text)
				if (!text) {
					uni.showToast({ title: '未识别到语音内容', icon: 'none' })
					return
				}
				if (parsedItems.length > 1) {
					const sharedLocation = this.normalizeVoiceLocation(voiceIntent.location || this.form.location || '冷藏')
					const sharedExpireDate = voiceIntent.expireDate || this.form.expireDate || ''
					this.batchItems = parsedItems.map((item) =>
						this.normalizeRecognizedItem({
							name: this.extractVoiceIntent(item?.name).name || item?.name,
							category: item?.category,
							quantity: item?.quantity || this.extractVoiceIntent(item?.name).quantity,
							unit: item?.unit || this.extractVoiceIntent(item?.name).unit,
							location: item?.location || this.extractVoiceIntent(item?.name).location
						}, sharedLocation, sharedExpireDate)
					)
					this.batchVisible = true
					uni.showToast({ title: `语音识别到${parsedItems.length}条，请确认`, icon: 'none' })
					return
				}
				const firstItem = parsedItems[0] || {}
				const firstIntent = this.extractVoiceIntent(firstItem?.name || '')
				const parsedIntent = this.extractVoiceIntent(parsedName || '')
				const nextName = firstIntent.name || parsedIntent.name || voiceIntent.name || parsedName || text
				this.form.name = `${nextName}`.trim()
				const finalQuantity = Number(firstItem?.quantity)
				if (Number.isFinite(finalQuantity) && finalQuantity > 0) {
					this.form.quantity = `${finalQuantity}`
				} else if (Number.isFinite(parsedQuantity) && parsedQuantity > 0) {
					this.form.quantity = `${parsedQuantity}`
				} else if (Number.isFinite(voiceIntent.quantity) && voiceIntent.quantity > 0) {
					this.form.quantity = `${voiceIntent.quantity}`
				} else if (Number.isFinite(firstIntent.quantity) && firstIntent.quantity > 0) {
					this.form.quantity = `${firstIntent.quantity}`
				}
				const finalUnit = `${firstItem?.unit || parsedUnit || firstIntent.unit || voiceIntent.unit || ''}`.trim()
				const normalizedUnit = this.normalizeVoiceUnit(finalUnit, this.form.name, this.form.category)
				if (normalizedUnit) this.form.unit = normalizedUnit
				const voiceLocation = this.normalizeVoiceLocation(firstItem?.location || firstIntent.location || voiceIntent.location)
				if (voiceLocation) {
					this.form.location = voiceLocation
				}
				if (voiceIntent.expireDate) {
					this.form.expireDate = voiceIntent.expireDate
				}
				const inferredCategory = this.inferCategoryByName(this.form.name)
				const voiceCategory = this.categories.includes(firstItem?.category) ? firstItem.category : (inferredCategory || '')
				if (voiceCategory) {
					this.form.category = voiceCategory
					if (!voiceIntent.expireDate) {
						this.form.expireDate = this.getExpireDateByCategory(voiceCategory)
					}
				}
				uni.showToast({ title: '已填入名称/数量/单位/位置/过期日期', icon: 'none' })
			} catch (e) {
				const msg = `${e?.message || ''}`.trim() || '语音识别失败，请重试'
				uni.showToast({ title: msg, icon: 'none' })
			} finally {
				uni.hideLoading()
			}
		},
		normalizeVoiceUnit(unit, name, category) {
			const text = `${unit || ''}`.trim()
			if (!text) return ''
			if (this.units.includes(text)) return text
			const aliasMap = {
				公斤: '公斤',
				千克: '千克',
				克: '克',
				斤: '斤',
				两: '两',
				个: '个',
				颗: '颗',
				袋: '袋',
				包: '包',
				瓶: '瓶',
				盒: '盒',
				罐: '罐',
				把: '把',
				根: '根',
				条: '条',
				片: '片',
				块: '块',
				份: '份',
				毫升: '毫升',
				升: '升'
			}
			const mapped = aliasMap[text]
			if (mapped && this.units.includes(mapped)) return mapped
			return this.normalizeRecognizedUnit(text, name, category)
		},
		recognizeIngredient() {
			this.startRecognize('ingredient')
		},
		recognizeReceipt() {
			this.startRecognize('receipt')
		},
		async startRecognize(mode = 'ingredient') {
			try {
				const chooseRes = await this.chooseLocalImage()
				const filePath = chooseRes?.tempFilePaths?.[0]
				if (!filePath) return

				const loadingText = mode === 'receipt' ? '小票识别中...' : '识别中...'
				uni.showLoading({ title: loadingText })
				const res =
					mode === 'receipt'
						? await recognizeReceiptByUpload(filePath)
						: await recognizeIngredientsByUpload(filePath)
				const list = Array.isArray(res?.data?.ingredients) ? res.data.ingredients : []
				if (!list.length) {
					const msg = mode === 'receipt' ? '未识别到小票食材条目' : '未识别到食材'
					uni.showToast({ title: msg, icon: 'none' })
					return
				}

				this.batchItems = list.map((item) => this.normalizeRecognizedItem(item))
				this.batchVisible = true
				uni.showToast({ title: `识别到${list.length}条，请确认`, icon: 'none' })
			} catch (e) {
				console.error('识别失败', e)
				const rawMessage = `${e?.message || e?.errMsg || e?.data?.message || ''}`.trim()
				const msg = rawMessage.includes('timeout') || rawMessage.includes('超时')
					? '识别超时，请检查网络后重试'
					: (rawMessage || '识别失败，请重试')
				uni.showToast({ title: msg, icon: 'none' })
			} finally {
				uni.hideLoading()
			}
		},
		normalizeRecognizedItem(item, fallbackLocation = '', fallbackExpireDate = '') {
			const intent = this.extractVoiceIntent(item?.name || '')
			const name = item?.name ? `${intent.name || item.name}` : ''
			const guessedCategory = this.inferCategoryByName(name)
			const category = this.categories.includes(item?.category) ? item.category : (guessedCategory || '其他')
			const quantity = item?.quantity || item?.quantity === 0 ? `${item.quantity}` : '1'
			const unit = this.normalizeRecognizedUnit(item?.unit, name, category)
			const location = this.normalizeVoiceLocation(item?.location || intent.location || fallbackLocation || this.form.location || '冷藏')
			const expireDate = this.normalizeVoiceExpireDate(item?.expireDate || intent.expireDate || fallbackExpireDate || this.form.expireDate)
			return {
				name,
				category,
				quantity,
				unit,
				location,
				expireDate: expireDate || this.getExpireDateByCategory(category),
				selected: true
			}
		},
		normalizeVoiceLocation(raw) {
			const text = `${raw || ''}`.trim()
			if (!text) return ''
			if (
				text.includes('冷冻') ||
				text.includes('冷凍') ||
				text.includes('冻起来') ||
				text.includes('冷冻层') ||
				text.includes('冷冻柜') ||
				text.includes('冷冻室')
			) return '冷冻'
			if (
				text.includes('冷藏') ||
				text.includes('冷藏室') ||
				text.includes('冷藏层') ||
				text.includes('保鲜') ||
				text.includes('保鲜层') ||
				text.includes('放冰箱') ||
				text.includes('冰箱里')
			) return '冷藏'
			return ''
		},
		normalizeVoiceExpireDate(raw) {
			const text = `${raw || ''}`.trim()
			if (!text) return ''
			const m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
			if (m) {
				const y = Number(m[1])
				const month = Number(m[2])
				const day = Number(m[3])
				if (!Number.isFinite(y) || !Number.isFinite(month) || !Number.isFinite(day)) return ''
				const date = new Date(y, month - 1, day)
				if (!Number.isFinite(date.getTime())) return ''
				return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`
			}
			return ''
		},
		formatDateOffset(days) {
			const n = Number(days)
			if (!Number.isFinite(n)) return ''
			const date = new Date()
			date.setHours(0, 0, 0, 0)
			date.setDate(date.getDate() + Math.max(0, Math.floor(n)))
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			return `${y}-${m}-${d}`
		},
		formatDateYmd(date) {
			if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return ''
			const y = date.getFullYear()
			const m = `${date.getMonth() + 1}`.padStart(2, '0')
			const d = `${date.getDate()}`.padStart(2, '0')
			return `${y}-${m}-${d}`
		},
		getUpcomingWeekdayDate(targetWeekday, weekOffset = 0) {
			const weekday = Number(targetWeekday)
			if (!Number.isFinite(weekday) || weekday < 0 || weekday > 6) return ''
			const offset = Math.max(0, Number(weekOffset) || 0)
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			const current = today.getDay()
			let delta = (weekday - current + 7) % 7
			delta += offset * 7
			if (offset === 0 && delta === 0) delta = 7
			const target = new Date(today)
			target.setDate(today.getDate() + delta)
			return this.formatDateYmd(target)
		},
		getMonthEndDate(monthOffset = 0) {
			const offset = Math.max(0, Number(monthOffset) || 0)
			const now = new Date()
			const date = new Date(now.getFullYear(), now.getMonth() + 1 + offset, 0)
			date.setHours(0, 0, 0, 0)
			return this.formatDateYmd(date)
		},
		parseVoiceExpireDate(text) {
			const raw = `${text || ''}`.trim()
			if (!raw) return ''
			const compact = raw.replace(/\s+/g, '')
			if (compact.includes('今天过期') || compact.includes('今日过期')) return this.formatDateOffset(0)
			if (compact.includes('明天过期')) return this.formatDateOffset(1)
			if (compact.includes('后天过期')) return this.formatDateOffset(2)
			const relativeDays =
				compact.match(/(?:过|再过|还有)?([零一二两三四五六七八九十百千万\d]+)天(?:后)?(?:过期|到期|吃完)?/) ||
				compact.match(/([零一二两三四五六七八九十百千万\d]+)天(?:后)?/)
			if (relativeDays && relativeDays[1]) {
				const days = this.parseChineseVoiceNumber(relativeDays[1])
				if (Number.isFinite(days) && days >= 0) return this.formatDateOffset(days)
			}

			const relativeWeeks = compact.match(/([零一二两三四五六七八九十百千万\d]+)周后(?:过期|到期|吃完)?/)
			if (relativeWeeks && relativeWeeks[1]) {
				const weeks = this.parseChineseVoiceNumber(relativeWeeks[1])
				if (Number.isFinite(weeks) && weeks >= 0) return this.formatDateOffset(weeks * 7)
			}
			if (compact.includes('下下周')) return this.formatDateOffset(14)
			if (compact.includes('下周')) return this.formatDateOffset(7)

			const weekdayMap = {
				周日: 0, 周天: 0, 星期日: 0, 星期天: 0,
				周一: 1, 星期一: 1,
				周二: 2, 星期二: 2,
				周三: 3, 星期三: 3,
				周四: 4, 星期四: 4,
				周五: 5, 星期五: 5,
				周六: 6, 星期六: 6
			}
			const weekdayMatch = compact.match(/(下下周|下周)?(周[一二三四五六日天]|星期[一二三四五六日天])(?:过期|到期|吃完)?/)
			if (weekdayMatch) {
				const prefix = `${weekdayMatch[1] || ''}`
				const weekdayText = `${weekdayMatch[2] || ''}`
				const targetWeekday = weekdayMap[weekdayText]
				const weekOffset = prefix === '下下周' ? 2 : prefix === '下周' ? 1 : 0
				const date = this.getUpcomingWeekdayDate(targetWeekday, weekOffset)
				if (date) return date
			}

			if (compact.includes('月底过期') || compact.includes('月末过期') || compact.includes('月末前吃完') || compact.includes('月底前吃完')) {
				return this.getMonthEndDate(0)
			}

			const isoDate = compact.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:过期|到期)?/)
			if (isoDate) {
				const y = Number(isoDate[1])
				const month = Number(isoDate[2])
				const day = Number(isoDate[3])
				const date = new Date(y, month - 1, day)
				if (Number.isFinite(date.getTime())) return this.formatDateYmd(date)
			}

			const absolute = compact.match(/(\d{4})年(\d{1,2})月(\d{1,2})[日号]?(?:过期|到期)?/)
			if (absolute) {
				const y = Number(absolute[1])
				const month = Number(absolute[2])
				const day = Number(absolute[3])
				const date = new Date(y, month - 1, day)
				if (Number.isFinite(date.getTime())) return this.formatDateYmd(date)
			}

			const absoluteZhYear = compact.match(/([零〇一二两三四五六七八九]{4})年([零一二两三四五六七八九十\d]{1,3})月([零一二两三四五六七八九十\d]{1,3})[日号]?(?:过期|到期)?/)
			if (absoluteZhYear) {
				const y = this.parseChineseYear(absoluteZhYear[1])
				const month = this.parseChineseVoiceNumber(absoluteZhYear[2])
				const day = this.parseChineseVoiceNumber(absoluteZhYear[3])
				if (Number.isFinite(y) && Number.isFinite(month) && Number.isFinite(day)) {
					const date = new Date(y, Number(month) - 1, Number(day))
					if (Number.isFinite(date.getTime())) return this.formatDateYmd(date)
				}
			}

			const shortDate = compact.match(/(\d{1,2})月(\d{1,2})[日号]?(?:过期|到期)?/)
			if (shortDate) {
				const month = Number(shortDate[1])
				const day = Number(shortDate[2])
				if (!Number.isFinite(month) || !Number.isFinite(day)) return ''
				const now = new Date()
				const currentYear = now.getFullYear()
				let date = new Date(currentYear, month - 1, day)
				date.setHours(0, 0, 0, 0)
				const today = new Date()
				today.setHours(0, 0, 0, 0)
				if (date.getTime() < today.getTime()) {
					date = new Date(currentYear + 1, month - 1, day)
					date.setHours(0, 0, 0, 0)
				}
				if (Number.isFinite(date.getTime())) return this.formatDateYmd(date)
			}

			const shortDateZh = compact.match(/([零一二两三四五六七八九十\d]{1,3})月([零一二两三四五六七八九十\d]{1,3})[日号]?(?:过期|到期)?/)
			if (shortDateZh) {
				const month = this.parseChineseVoiceNumber(shortDateZh[1])
				const day = this.parseChineseVoiceNumber(shortDateZh[2])
				if (!Number.isFinite(month) || !Number.isFinite(day)) return ''
				const now = new Date()
				const currentYear = now.getFullYear()
				let date = new Date(currentYear, Number(month) - 1, Number(day))
				date.setHours(0, 0, 0, 0)
				const today = new Date()
				today.setHours(0, 0, 0, 0)
				if (date.getTime() < today.getTime()) {
					date = new Date(currentYear + 1, Number(month) - 1, Number(day))
					date.setHours(0, 0, 0, 0)
				}
				if (Number.isFinite(date.getTime())) return this.formatDateYmd(date)
			}
			return ''
		},
		parseChineseVoiceNumber(raw) {
			const text = `${raw || ''}`.trim()
			if (!text) return undefined
			const num = Number(text)
			if (Number.isFinite(num) && num > 0) return num
			const map = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
			if (text.length === 1 && map[text] !== undefined) return map[text]
			if (text === '十一') return 11
			if (text === '十二') return 12
			if (text === '十三') return 13
			if (text === '十四') return 14
			if (text === '十五') return 15
			if (text === '十六') return 16
			if (text === '十七') return 17
			if (text === '十八') return 18
			if (text === '十九') return 19
			if (text === '二十') return 20
			return undefined
		},
		parseChineseYear(raw) {
			const text = `${raw || ''}`.trim()
			if (!text) return undefined
			const direct = Number(text)
			if (Number.isFinite(direct) && `${Math.floor(direct)}`.length === 4) return Math.floor(direct)
			const map = { 零: '0', 〇: '0', 一: '1', 二: '2', 两: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9' }
			let digits = ''
			for (const ch of text) {
				if (!map[ch]) return undefined
				digits += map[ch]
			}
			if (digits.length !== 4) return undefined
			const year = Number(digits)
			return Number.isFinite(year) ? year : undefined
		},
		cleanVoiceSemanticSuffix(text) {
			return `${text || ''}`
				.replace(/(放在|放到|放进|放入|存到|存入|放至|存至|放|存|冻起来|冻上|冻)\s*(冷藏|冷藏室|冷藏层|冷冻|冷冻室|冷冻层|冷冻柜|保鲜层?|冰箱)/g, ' ')
				.replace(/(冷藏|冷藏室|冷藏层|冷冻|冷冻室|冷冻层|冷冻柜|保鲜层?|放冰箱|冰箱里)/g, ' ')
				.replace(
					/(?:过|再过|还有)?\s*[零一二两三四五六七八九十百千万\d]+\s*天(?:后)?(?:过期|到期|吃完)?|[零一二两三四五六七八九十百千万\d]+\s*周后(?:过期|到期|吃完)?|下下周(?:过期|到期|吃完)?|下周(?:过期|到期|吃完)?|(下下周|下周)?\s*(周[一二三四五六日天]|星期[一二三四五六日天])(?:过期|到期|吃完)?|今天过期|今日过期|明天过期|后天过期|月底过期|月末过期|月末前吃完|月底前吃完|\d{4}\s*[-/.]\s*\d{1,2}\s*[-/.]\s*\d{1,2}(?:过期|到期)?|\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*[日号]?(?:过期|到期)?|\d{1,2}\s*月\s*\d{1,2}\s*[日号]?(?:过期|到期)?|[零一二两三四五六七八九十〇]{4}\s*年\s*[零一二三四五六七八九十两\d]{1,3}\s*月\s*[零一二三四五六七八九十两\d]{1,3}\s*[日号]?(?:过期|到期)?|[零一二三四五六七八九十两\d]{1,3}\s*月\s*[零一二三四五六七八九十两\d]{1,3}\s*[日号]?(?:过期|到期)?/g,
					' ',
				)
				.replace(/\s*(过期|到期|吃完)\s*$/g, ' ')
				.replace(/\s*(放在|放到|放进|放入|存到|存入|放至|存至|放|存|冻起来|冻上|冻)\s*$/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
		},
		extractVoiceIntent(rawText) {
			const origin = `${rawText || ''}`.trim()
			if (!origin) return { name: '', quantity: undefined, unit: '', location: '', expireDate: '' }
			let text = origin
				.replace(/[，,。；;！!？?]/g, ' ')
				.replace(/\s+/g, ' ')
				.trim()
			const location = this.normalizeVoiceLocation(text)
			const expireDate = this.parseVoiceExpireDate(text)
			text = this.cleanVoiceSemanticSuffix(text)
				.replace(/^(帮我|请|麻烦|把|将|我要|我想|给我)\s*/g, '')
				.trim()

			const unitPattern = '(个|颗|斤|公斤|千克|克|袋|包|瓶|盒|罐|把|根|条|片|块|份|毫升|升)'
			const qtyPattern = '([零一二两三四五六七八九十百千万\\d]+(?:\\.\\d+)?)'
			const qtyFirst = text.match(new RegExp(`^${qtyPattern}\\s*${unitPattern}?\\s*(.+)$`))
			const nameFirst = text.match(new RegExp(`^(.+?)\\s*${qtyPattern}\\s*${unitPattern}$`))
			let quantity
			let unit = ''
			let name = text
			if (qtyFirst) {
				quantity = this.parseChineseVoiceNumber(qtyFirst[1])
				unit = `${qtyFirst[2] || ''}`.trim()
				name = `${qtyFirst[3] || ''}`.trim()
			} else if (nameFirst) {
				quantity = this.parseChineseVoiceNumber(nameFirst[2])
				unit = `${nameFirst[3] || ''}`.trim()
				name = `${nameFirst[1] || ''}`.trim()
			}
			name = `${name || ''}`
				.replace(/^(一个|一份|一斤|一袋|一包|一盒|一瓶|一罐|一根|一条|一片|一块)\s*/g, '')
				.replace(/\s*([零一二两三四五六七八九十百千万\d]+)\s*(个|颗|斤|公斤|千克|克|袋|包|瓶|盒|罐|把|根|条|片|块|份|毫升|升)\s*$/g, '')
				.replace(/([零一二两三四五六七八九十百千万\d]+)\s*(放|存|冻)$/g, '')
				.replace(/(放在|放到|放进|放入|存到|存入|放至|存至|放|存|冻起来|冻上|冻)$/g, '')
				.trim()
			return {
				name,
				quantity,
				unit,
				location,
				expireDate
			}
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
		normalizeRecognizedUnit(rawUnit, name, category) {
			const fallback = this.inferUnitByName(name, category)
			const text = `${rawUnit || ''}`.trim()
			if (!text) return fallback
			if (this.units.includes(text)) return text

			const key = text.toLowerCase()
			const aliasMap = {
				g: '克',
				gram: '克',
				grams: '克',
				kg: '千克',
				kgs: '千克',
				kilogram: '千克',
				kilograms: '千克',
				ml: '毫升',
				milliliter: '毫升',
				milliliters: '毫升',
				l: '升',
				liter: '升',
				liters: '升',
				jin: '斤',
				liang: '两',
				piece: '个',
				pieces: '个',
				pc: '个',
				box: '盒',
				can: '罐',
				pack: '包',
				bag: '袋',
				bottle: '瓶',
				strip: '条',
				slice: '片',
				stick: '根',
				block: '块',
				group: '组',
				handful: '把',
				cup: '杯',
				bowl: '碗',
				plate: '盘',
				roll: '卷',
				section: '段',
				basket: '篮',
				bundle: '捆',
				string: '串',
				row: '排',
				bucket: '桶',
				case: '箱',
				tube: '管'
			}
			const mapped = aliasMap[key] || aliasMap[key.replace(/\./g, '')]
			if (mapped && this.units.includes(mapped)) return mapped
			return fallback
		},
		inferUnitByName(name, category) {
			const text = `${name || ''}`.toLowerCase()
			const cat = `${category || ''}`
			if (/牛奶|酸奶|饮料|果汁|可乐|雪碧|豆浆|啤酒|矿泉水|椰汁|苏打/.test(text)) return '毫升'
			if (/牛肉|猪肉|鸡胸|鸡肉|排骨|肉糜|肉馅|虾仁|鱼片/.test(text)) return '克'
			if (/鸡蛋|鹌鹑蛋/.test(text)) return '颗'
			if (/面条|米线|粉丝/.test(text)) return '包'
			if (/豆腐|年糕/.test(text)) return '块'
			if (cat === '肉类') return '克'
			if (cat === '饮料') return '毫升'
			return '个'
		},
		inferCategoryByName(name) {
			const text = `${name || ''}`
			if (!text) return ''
			if (/(苹果|香蕉|橙|梨|桃|葡萄|莓|西瓜|哈密瓜|柚|柠檬|樱桃|芒果|菠萝|榴莲)/.test(text)) return '水果'
			if (/(菜|葱|姜|蒜|椒|茄|瓜|萝卜|土豆|西兰花|蘑菇|菌|豆角|白菜|生菜|菠菜|芹菜)/.test(text)) return '蔬菜'
			if (/(牛肉|猪肉|羊肉|鸡肉|鸭肉|排骨|里脊|肉馅|火腿|培根)/.test(text)) return '肉类'
			if (/(蛋|牛奶|酸奶|芝士|黄油|奶酪|奶油)/.test(text)) return '蛋奶'
			if (/(虾|鱼|蟹|贝|蛤|鱿鱼|海参|海带)/.test(text)) return '海鲜'
			if (/(可乐|雪碧|果汁|饮料|矿泉水|纯净水|茶饮|咖啡)/.test(text)) return '饮料'
			if (/(酱|醋|盐|糖|料酒|生抽|老抽|蚝油|胡椒|孜然|番茄酱|沙拉酱)/.test(text)) return '调味品'
			return '其他'
		},
		onBatchCategoryChange(index, e) {
			const category = this.categories[e.detail.value]
			this.batchItems[index].category = category
			this.batchItems[index].expireDate = this.getExpireDateByCategory(category)
		},
		onBatchUnitChange(index, e) {
			this.batchItems[index].unit = this.units[e.detail.value]
		},
		onBatchLocationChange(index, e) {
			this.batchItems[index].location = this.locations[e.detail.value]
		},
		onBatchExpireDateChange(index, e) {
			const value = e?.detail?.value || ''
			const today = new Date().toISOString().slice(0, 10)
			if (value && value < today) {
				uni.showToast({ title: `第${index + 1}条过期时间不能早于今天`, icon: 'none' })
				this.batchItems[index].expireDate = ''
				return
			}
			this.batchItems[index].expireDate = value
		},
		toggleBatchSelected(index) {
			this.batchItems[index].selected = this.batchItems[index].selected === false
		},
		toggleBatchSelectAll() {
			const next = this.batchSelectedCount !== this.batchItems.length
			this.batchItems = this.batchItems.map((item) => ({ ...item, selected: next }))
		},
		closeBatchPanel() {
			this.batchVisible = false
			this.batchItems = []
		},
		getBatchQuantity(item) {
			const n = Number(item?.quantity)
			return Number.isFinite(n) && n > 0 ? Math.round(n) : 1
		},
		decreaseBatchQty(index) {
			const current = this.getBatchQuantity(this.batchItems[index])
			this.batchItems[index].quantity = `${Math.max(1, current - 1)}`
		},
		increaseBatchQty(index) {
			const current = this.getBatchQuantity(this.batchItems[index])
			this.batchItems[index].quantity = `${current + 1}`
		},
		validateBatchItem(item, index) {
			if (!item.name || !item.category || !item.quantity || !item.unit || !item.location || !item.expireDate) {
				uni.showToast({ title: `第${index + 1}条信息不完整`, icon: 'none' })
				return false
			}
			const quantity = Number(item.quantity)
			if (!Number.isFinite(quantity) || quantity <= 0) {
				uni.showToast({ title: `第${index + 1}条数量不合法`, icon: 'none' })
				return false
			}
			const today = new Date().toISOString().slice(0, 10)
			if (item.expireDate < today) {
				uni.showToast({ title: `第${index + 1}条过期时间过早`, icon: 'none' })
				return false
			}
			return true
		},
		async submitBatch() {
			if (!this.batchItems.length || this.batchSubmitting) return
			const selectedItems = this.batchItems.filter((item) => item.selected !== false)
			if (!selectedItems.length) {
				uni.showToast({ title: '请至少勾选一条食材', icon: 'none' })
				return
			}
			for (let i = 0; i < selectedItems.length; i += 1) {
				if (!this.validateBatchItem(selectedItems[i], i)) return
			}

			this.batchSubmitting = true
			uni.showLoading({ title: '批量入库中...' })
			try {
				for (const item of selectedItems) {
					await createIngredient({
						name: item.name,
						category: item.category,
						quantity: Number(item.quantity),
						unit: item.unit,
						location: item.location,
						expireDate: item.expireDate || null,
						userId: this.userId
					})
				}
				uni.showToast({ title: `成功入库${selectedItems.length}条`, icon: 'success' })
				this.closeBatchPanel()
				setTimeout(() => {
					uni.navigateBack({ delta: 1 })
				}, 300)
			} catch (e) {
				console.error('批量新增失败', e)
				uni.showToast({ title: '批量入库失败，请重试', icon: 'none' })
			} finally {
				this.batchSubmitting = false
				uni.hideLoading()
			}
		},
		onCategoryChange(e) {
			const category = this.categories[e.detail.value]
			this.form.category = category
			this.form.expireDate = this.getExpireDateByCategory(category)
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
		resetManualForm() {
			this.form = {
				name: '',
				category: '',
				quantity: '',
				unit: '份',
				location: '',
				expireDate: ''
			}
		},
		async submit() {
			if (!this.form.name || !this.form.category || !this.form.quantity || !this.form.unit || !this.form.location || !this.form.expireDate) {
				uni.showToast({ title: '请先填写完整信息', icon: 'none' })
				return
			}
		
			const today = new Date().toISOString().slice(0, 10)
			if (this.form.expireDate < today) {
				uni.showToast({ title: '过期日期不能早于今天', icon: 'none' })
				return
			}
		
			try {
				await createIngredient({
					name: this.form.name,
					category: this.form.category,
					quantity: Number(this.form.quantity),
					unit: this.form.unit,
					location: this.form.location,
					expireDate: this.form.expireDate || null,
					userId: this.userId
				})
		
				uni.showToast({ title: '保存成功', icon: 'success' })
				this.resetManualForm()
			} catch (e) {
				console.error('新增失败', e)
				uni.showToast({
					title: '保存失败',
					icon: 'none'
				})
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
	justify-content: space-between;
	align-items: center;
	margin-bottom: 8rpx;
}

.top-title {
	font-size: 20px;
	font-weight: 700;
}

.capsule {
	border: 1rpx solid #e2e9e4;
	border-radius: 999rpx;
	background: #fff;
	padding: 6rpx 16rpx;
	font-size: 14px;
	display: flex;
	gap: 10rpx;
}

.card {
	background: #fff;
	border: 1rpx solid #edf2ef;
	border-radius: 16px;
	padding: 12px;
	margin-bottom: 12rpx;
	box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07);
}

.section-title {
	font-size: 14px;
	font-weight: 700;
}

.section-title-wrap {
	display: inline-flex;
	align-items: center;
	gap: 6rpx;
}

.head-row {
	display: flex;
	justify-content: space-between;
	align-items: center;
	margin-bottom: 12rpx;
}

.ai-tag {
	background: #e8f0ff;
	color: #4a73d9;
	padding: 4rpx 12rpx;
	border-radius: 999rpx;
	font-size: 11px;
}

.recognize-row {
	display: flex;
	gap: 12rpx;
}

.recognize-btn {
	flex: 1;
	border: 2rpx dashed #cfe0fa;
	border-radius: 20px;
	min-height: 230rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: #f4f8ff;
}

.recognize-btn.receipt {
	border-color: #cfe0fa;
	background: #f4f8ff;
}

.mask {
	position: fixed;
	inset: 0;
	background: rgba(14, 24, 17, 0.42);
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 12px;
	z-index: 99;
}

.dialog {
	width: 100%;
	max-width: 700rpx;
	background: #fff;
	border-radius: 18px;
	padding: 14px 12px 12px;
	box-shadow: 0 14rpx 30rpx rgba(17, 34, 22, 0.22);
}

.batch-dialog {
	max-height: 82vh;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.batch-head {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 10rpx;
}

.batch-title {
	font-size: 15px;
	font-weight: 700;
	color: #21362b;
}

.batch-actions {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.batch-action {
	font-size: 12px;
	color: #4a73d9;
}

.batch-list {
	display: flex;
	flex-direction: column;
	gap: 10rpx;
	max-height: 56vh;
	padding: 6px 2px 2px;
	overflow: auto;
}

.batch-row {
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.batch-selector {
	width: 28rpx;
	height: 28rpx;
	border-radius: 50%;
	border: 2rpx solid #d7e5dc;
	background: #f8fcf9;
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
}

.batch-selector.on {
	border-color: #5f95f2;
	background: #5f95f2;
}

.batch-selector-check {
	color: #fff;
	font-size: 10px;
	font-weight: 700;
}

.batch-item {
	flex: 1;
	border: 1rpx solid #d9e6fb;
	border-radius: 12px;
	padding: 10px;
	background: #f6f9ff;
}

.batch-item.muted {
	opacity: 0.65;
}

.batch-line1 {
	display: flex;
	align-items: center;
	gap: 8rpx;
	margin-bottom: 8rpx;
}

.batch-name {
	flex: 1;
	height: 56rpx;
	background: #fff;
	border: 1rpx solid #dde8e0;
	border-radius: 10px;
	padding: 0 10rpx;
	font-size: 16px;
	font-weight: 700;
}

.batch-stepper {
	height: 56rpx;
	display: flex;
	align-items: center;
	gap: 10rpx;
}

.step-btn {
	width: 28rpx;
	height: 28rpx;
	border-radius: 8rpx;
	background: #eef5ff;
	color: #4a73d9;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	line-height: 1;
	font-size: 18px;
	font-weight: 700;
	position: relative;
}

.step-sign {
	position: relative;
	width: 16rpx;
	height: 16rpx;
	display: block;
}

.minus-sign::before,
.plus-sign::before,
.plus-sign::after {
	content: '';
	position: absolute;
	left: 50%;
	top: 50%;
	background: #4a73d9;
	border-radius: 999rpx;
	transform: translate(-50%, -50%);
}

.minus-sign::before,
.plus-sign::before {
	width: 14rpx;
	height: 3rpx;
}

.plus-sign::after {
	width: 3rpx;
	height: 14rpx;
}

.step-val {
	min-width: 24rpx;
	text-align: center;
	font-size: 15px;
	font-weight: 700;
}

.batch-unit {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	height: 44rpx;
	padding: 0 12rpx;
	border-radius: 999rpx;
	background: #e7f1ff;
	border: 1rpx solid #bdd4f8;
	font-size: 13px;
	color: #4a86df;
	font-weight: 600;
}

.batch-line2 {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 8rpx;
}

.batch-meta {
	display: inline-flex;
	align-items: center;
	gap: 4rpx;
	height: 42rpx;
	padding: 0 8rpx;
	border-radius: 8px;
	background: #f6faf7;
}

.batch-meta-txt {
	font-size: 13px;
	color: #6e8175;
	white-space: nowrap;
}

.batch-meta-dot {
	font-size: 15px;
	font-weight: 700;
	color: #6e8175;
	line-height: 1;
}

.batch-meta-ico {
	font-size: 14px;
	color: #4f8fe8;
	line-height: 1;
}

.camera {
	font-size: 56rpx;
}

.recognize-title {
	font-weight: 700;
	margin-top: 6rpx;
	font-size: 14px;
}

.recognize-meta {
	color: #738177;
	font-size: 12px;
	margin-top: 4rpx;
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

.section-title-wrap .ai-iconfont {
	color: #4f8fe8;
	font-size: 19px;
}

.recognize-btn .camera.ai-iconfont {
	color: #4f8fe8;
}

.recognize-btn.receipt .camera.ai-iconfont {
	color: #4f8fe8;
}

/* Keep colors separated by area:
   - batch result expire icon: blue
   - manual form expire icon: green */
.batch-meta .batch-meta-ico {
	color: #4f8fe8 !important;
}

.row-icon.expire-icon {
	color: #4cae57 !important;
}

.form-card {
	padding: 10px;
}

.manual-head {
	display: inline-flex;
	align-items: center;
	gap: 6rpx;
	margin-bottom: 12rpx;
}

.manual-icon {
	color: #4cae57;
	font-size: 20px;
}

.manual-title {
	font-size: 14px;
	font-weight: 700;
	color: #24362b;
}

.req {
	color: #e15c5c;
	margin-left: 6rpx;
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
	color: #4f8fe8;
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

.voice-btn {
	width: 34px;
	height: 34px;
	border-radius: 999rpx;
	background: #e8f0ff;
	color: #4a73d9;
	display: inline-flex;
	align-items: center;
	justify-content: center;
	padding: 0;
}

.voice-btn.on {
	background: #4a73d9;
	color: #fff;
}

.voice-btn.disabled {
	opacity: 0.5;
}

.voice-ico {
	font-size: 16px;
	color: inherit;
}

.side-req {
	font-size: 16px;
	line-height: 1;
	margin-left: 8rpx;
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

.submit-btn {
	background: linear-gradient(135deg, #70c977, #4cae57);
	color: #fff;
	border-radius: 999rpx;
	margin-top: 10rpx;
	font-weight: 700;
	font-size: 13px;
}

.batch-submit-btn {
	background: linear-gradient(135deg, #79aef6, #5f95f2);
	width: 100%;
	display: block;
	margin-top: 12rpx;
}
</style>
