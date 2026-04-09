<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back-left" @click="goBack">
				<text class="back-arrow">‹</text>
			</view>
			<text class="top-title">临期提醒</text>
		</view>

		<view class="card top-setting-card">
			<view class="row">
				<view class="row-half">
					<text class="label">每日提醒</text>
				</view>
				<view class="row-half right">
					<button class="sub-btn compact right-control" @click="requestSubscribe">微信授权</button>
				</view>
			</view>
			<view class="row">
				<view class="row-half">
					<text class="label">提醒时间</text>
				</view>
				<view class="row-half right">
					<picker mode="time" :value="settings.remindTime" @change="onTimeChange">
						<view class="time-pill right-control">{{ settings.remindTime }}</view>
					</picker>
				</view>
			</view>
			<text class="hint">授权后将在设定时间提醒临期食材</text>
		</view>

		<view class="card">
			<view v-for="cat in categories" :key="cat" class="rule-row">
				<view class="rule-main">
					<view class="cat-ico">
						<IngredientIcon :name="cat" :category="cat" :size="34" />
					</view>
					<text class="cat">{{ cat }}</text>
				</view>
				<picker :range="dayOptions" :value="getLimitDays(cat)" @change="onRulePick(cat, $event)">
					<view class="days-inline">
						<text class="pre">提前</text>
						<text class="day-box">{{ getLimitDays(cat) }}</text>
						<text class="suf">天</text>
					</view>
				</picker>
			</view>
		</view>

		<view class="action-row">
			<button class="btn ghost" @click="resetDefaults">恢复默认</button>
			<button class="btn primary" @click="saveSettings">保存设置</button>
		</view>

		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import {
	getExpiryReminderSettings,
	updateExpiryReminderSettings
} from '@/api/modules/expiry-reminder'
import { getCurrentUserId } from '@/utils/current-user'

const CATEGORIES = ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他']
const DEV_SUBSCRIBE_TEMPLATE_IDS = ['Be9XDSuceuvjfxx01bjzV_yAh9T2WkvQt8ReSw0GUyw']
const DEFAULT_SETTINGS = {
	enabled: true,
	remindTime: '09:00',
	defaultDays: 2,
	subscribe: {
		templateIds: [],
		authResult: {},
		lastAuthAt: '',
		lastAuthStatus: 'unknown'
	},
	rules: {
		水果: 1,
		蔬菜: 2,
		肉类: 3,
		蛋奶: 2,
		海鲜: 1,
		饮料: 5,
		调味品: 7,
		其他: 2
	}
}

function cloneDefaults() {
	return JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
}

export default {
	components: { BottomNav, IngredientIcon },
	data() {
		return {
			userId: getCurrentUserId(),
			categories: CATEGORIES,
			settings: cloneDefaults(),
			dayOptions: Array.from({ length: 31 }, (_, i) => i)
		}
	},
	onLoad() {
		this.userId = getCurrentUserId()
		this.loadSettings()
	},
	methods: {
		goBack() {
			uni.switchTab({
				url: '/pages/profile/index'
			})
		},
		clampDays(value) {
			const n = Number(value)
			if (!Number.isFinite(n)) return 0
			return Math.min(Math.max(Math.round(n), 0), 30)
		},
		getLimitDays(category) {
			const rule = this.settings.rules && this.settings.rules[category]
			if (rule === undefined || rule === null) return this.settings.defaultDays
			return this.clampDays(rule)
		},
		normalizeSubscribe(raw) {
			const source = raw && typeof raw === 'object' ? raw : {}
			const templateIds = Array.isArray(source.templateIds)
				? source.templateIds.map((x) => `${x || ''}`.trim()).filter(Boolean).slice(0, 20)
				: []
			const authResultRaw = source.authResult && typeof source.authResult === 'object' ? source.authResult : {}
			const authResult = {}
			Object.keys(authResultRaw).forEach((key) => {
				const k = `${key || ''}`.trim()
				if (!k) return
				authResult[k] = `${authResultRaw[key] || ''}`.trim()
			})
			const lastAuthAt = `${source.lastAuthAt || ''}`.trim()
			const lastAuthStatus = `${source.lastAuthStatus || ''}`.trim() || 'unknown'
			return {
				templateIds: templateIds.length ? templateIds : [...DEV_SUBSCRIBE_TEMPLATE_IDS],
				authResult,
				lastAuthAt,
				lastAuthStatus
			}
		},
		resolveTemplateIds() {
			const saved = this.settings?.subscribe?.templateIds || []
			const cleaned = saved.map((x) => `${x || ''}`.trim()).filter(Boolean)
			const valid = cleaned.filter((id) => !id.includes('替换') && !id.includes('YOUR_'))
			if (valid.length) return valid
			return DEV_SUBSCRIBE_TEMPLATE_IDS
				.map((x) => `${x || ''}`.trim())
				.filter((id) => !!id && !id.includes('替换') && !id.includes('YOUR_'))
		},
		requestSubscribe() {
			const templateIds = this.resolveTemplateIds()
			if (!templateIds.length) {
				uni.showToast({ title: '请先配置订阅模板ID', icon: 'none' })
				return
			}
			if (typeof uni.requestSubscribeMessage !== 'function') {
				uni.showToast({ title: '当前环境不支持订阅授权', icon: 'none' })
				return
			}
			uni.requestSubscribeMessage({
				tmplIds: templateIds,
				success: () => {
					uni.showToast({ title: '授权弹窗已完成', icon: 'none' })
				},
				fail: () => {
					uni.showToast({ title: '授权取消或失败，请重试', icon: 'none' })
				}
			})
		},
		async loadSettings() {
			try {
				const raw = await getExpiryReminderSettings(this.userId)
				if (!raw || typeof raw !== 'object') {
					this.settings = cloneDefaults()
					return
				}
				const merged = cloneDefaults()
				merged.enabled = !!raw.enabled
				merged.remindTime = `${raw.remindTime || merged.remindTime}`
				merged.defaultDays = this.clampDays(raw.defaultDays)
				merged.rules = { ...merged.rules }
				merged.subscribe = this.normalizeSubscribe(raw?.subscribe)
				this.categories.forEach((cat) => {
					const fromRaw = raw?.rules?.[cat]
					if (fromRaw !== undefined && fromRaw !== null) {
						merged.rules[cat] = this.clampDays(fromRaw)
					}
				})
				this.settings = merged
			} catch (e) {
				this.settings = cloneDefaults()
				uni.showToast({ title: '提醒设置加载失败', icon: 'none' })
			}
		},
		onTimeChange(e) {
			const value = `${e?.detail?.value || ''}`
			this.settings.remindTime = value || '09:00'
		},
		onRulePick(category, e) {
			const idx = Number(e?.detail?.value)
			const picked = this.dayOptions[idx]
			const next = this.clampDays(picked)
			this.settings.rules = {
				...this.settings.rules,
				[category]: next
			}
		},
		resetDefaults() {
			this.settings = cloneDefaults()
			uni.showToast({ title: '已恢复默认', icon: 'none' })
		},
		saveSettings() {
			updateExpiryReminderSettings({
				userId: this.userId,
				enabled: this.settings.enabled,
				remindTime: this.settings.remindTime,
				defaultDays: this.settings.defaultDays,
				rules: this.settings.rules,
				subscribe: this.normalizeSubscribe(this.settings.subscribe)
			})
				.then((saved) => {
					if (saved && typeof saved === 'object') {
						this.settings = {
							...this.settings,
							enabled: !!saved.enabled,
							remindTime: `${saved.remindTime || this.settings.remindTime}`,
							defaultDays: this.clampDays(saved.defaultDays),
							subscribe: this.normalizeSubscribe(saved?.subscribe || this.settings.subscribe),
							rules: {
								...this.settings.rules,
								...(saved.rules && typeof saved.rules === 'object' ? saved.rules : {})
							}
						}
					}
					uni.showToast({ title: '已保存提醒设置', icon: 'success' })
				})
				.catch(() => {
					uni.showToast({ title: '保存失败，请重试', icon: 'none' })
				})
		}
	}
}
</script>

<style scoped>
.container { padding: 10px 12px 88px; }
.top { display: flex; align-items: center; gap: 10rpx; margin-bottom: 12rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.back-left { width: 30px; height: 30px; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; }
.back-arrow { font-size: 30px; line-height: 1; color: #c7ced9; transform: translateY(-1px); }

.card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 16px; padding: 12px; margin-bottom: 10rpx; box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07); }
.top-setting-card { margin-top: 20rpx; }
.row { display: flex; align-items: center; justify-content: space-between; min-height: 64rpx; border-bottom: 1rpx solid #eef3f1; }
.top-setting-card .row:first-of-type { padding-bottom: 8rpx; }
.row:last-of-type { border-bottom: none; }
.row + .row { margin-top: 8rpx; }
.row-half { flex: 1; display: flex; align-items: center; min-width: 0; }
.row-half.right { justify-content: flex-end; }
.right-control { margin-left: auto; }
.label { font-size: 14px; font-weight: 700; color: #26352d; }
.time-pill { min-width: 106rpx; text-align: center; background: #edf5ef; color: #408a4d; border-radius: 999rpx; padding: 6rpx 12rpx; font-size: 12px; font-weight: 700; }
.sub-btn { border-radius: 999rpx; font-size: 12px; font-weight: 700; height: 34px; line-height: 34px; padding: 0 16rpx; background: #eef5ff; color: #4a73d9; border: 1rpx solid #d5e4ff; }
.sub-btn.compact { height: 30px; line-height: 30px; min-width: 106rpx; padding: 0 12rpx; text-align: center; margin: 0; }
.sub-btn::after { border: none; }
.status-line { margin-top: 6rpx; margin-bottom: 2rpx; }

.rule-row { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; padding: 8rpx 0; border-top: 1rpx solid #eef3f1; }
.rule-row:first-of-type { border-top: none; }
.rule-main { display: inline-flex; align-items: center; gap: 10rpx; }
.cat-ico { width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; }
.cat { font-size: 16px; font-weight: 600; color: #233229; }
.days-inline { display: inline-flex; align-items: center; gap: 6rpx; }
.pre, .suf { font-size: 14px; color: #28372e; }
.day-box { min-width: 50rpx; height: 46rpx; border-radius: 10px; border: 1rpx solid #dcebe1; background: #f6fcf8; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #6ebf85; padding: 0 8rpx; box-sizing: border-box; }

.hint { display: block; margin-top: 4rpx; font-size: 11px; color: #8d9c93; line-height: 1.5; }

.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 8rpx; }
.btn { width: 100%; border-radius: 999rpx; font-size: 13px; font-weight: 700; height: 42px; line-height: 42px; }
.btn.ghost { background: #ecf1ed; color: #637268; }
.btn.primary { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.26); }

.btn::after { border: none; }
</style>
