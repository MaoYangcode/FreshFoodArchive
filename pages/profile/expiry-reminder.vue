<template>
	<view class="container">
		<view class="top">
			<text class="top-title">临期提醒</text>
			<view class="capsule" @click="goBack">
				<svg class="back-ico-svg" aria-hidden="true">
					<use href="#icon-fanhui"></use>
				</svg>
			</view>
		</view>

		<view class="card top-setting-card">
			<view class="row">
				<view class="row-half">
					<text class="label">每日提醒</text>
				</view>
				<view class="row-half right">
					<switch :checked="settings.enabled" color="#4cae57" @change="onEnabledChange" />
				</view>
			</view>
			<view class="row">
				<view class="row-half">
					<text class="label">提醒时间</text>
				</view>
				<view class="row-half right">
					<picker mode="time" :value="settings.remindTime" @change="onTimeChange">
						<view class="time-pill">{{ settings.remindTime }}</view>
					</picker>
				</view>
			</view>
			<text class="hint">开启后将按设定时间提醒临期食材。</text>
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

const REMINDER_STORAGE_KEY = 'fresh-food-expiry-reminder-settings-v1'
const CATEGORIES = ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他']
const DEFAULT_SETTINGS = {
	enabled: true,
	remindTime: '09:00',
	defaultDays: 2,
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
			categories: CATEGORIES,
			settings: cloneDefaults(),
			dayOptions: Array.from({ length: 31 }, (_, i) => i)
		}
	},
	onLoad() {
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
		loadSettings() {
			try {
				const raw = uni.getStorageSync(REMINDER_STORAGE_KEY)
				if (!raw || typeof raw !== 'object') {
					this.settings = cloneDefaults()
					return
				}
				const merged = cloneDefaults()
				merged.enabled = !!raw.enabled
				merged.remindTime = `${raw.remindTime || merged.remindTime}`
				merged.defaultDays = this.clampDays(raw.defaultDays)
				merged.rules = { ...merged.rules }
				this.categories.forEach((cat) => {
					const fromRaw = raw?.rules?.[cat]
					if (fromRaw !== undefined && fromRaw !== null) {
						merged.rules[cat] = this.clampDays(fromRaw)
					}
				})
				this.settings = merged
			} catch (e) {
				this.settings = cloneDefaults()
			}
		},
		onEnabledChange(e) {
			this.settings.enabled = !!e?.detail?.value
			uni.showToast({
				title: this.settings.enabled ? '已开启提醒（后续接入订阅消息）' : '已关闭提醒',
				icon: 'none'
			})
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
			try {
				uni.setStorageSync(REMINDER_STORAGE_KEY, this.settings)
				uni.showToast({ title: '已保存提醒设置', icon: 'success' })
			} catch (e) {
				uni.showToast({ title: '保存失败，请重试', icon: 'none' })
			}
		},
		
	}
}
</script>

<style scoped>
.container { padding: 10px 12px 88px; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.capsule { border: 1rpx solid #e2e9e4; border-radius: 999rpx; background: #fff; min-width: 88rpx; height: 56rpx; padding: 0 16rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.back-ico-svg { width: 20px; height: 20px; display: block; }

.card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 16px; padding: 12px; margin-bottom: 10rpx; box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07); }
.top-setting-card { margin-top: 20rpx; }
.row { display: flex; align-items: center; justify-content: space-between; min-height: 64rpx; border-bottom: 1rpx solid #eef3f1; }
.row:last-of-type { border-bottom: none; }
.row + .row { margin-top: 8rpx; }
.row-half { flex: 1; display: flex; align-items: center; min-width: 0; }
.row-half.right { justify-content: flex-end; }
.label { font-size: 14px; font-weight: 700; color: #26352d; }
.time-pill { min-width: 106rpx; text-align: center; background: #edf5ef; color: #408a4d; border-radius: 999rpx; padding: 6rpx 12rpx; font-size: 12px; font-weight: 700; }
.row switch { transform: scale(0.96, 0.82); transform-origin: right center; }

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

.btn::after,
.btn::after { border: none; }
</style>
