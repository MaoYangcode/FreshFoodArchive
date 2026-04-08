<template>
	<view class="container">
		<view class="top">
			<text class="top-title">保质期设置</text>
			<view class="capsule" @click="goBack">
				<svg class="back-ico-svg" aria-hidden="true">
					<use href="#icon-fanhui"></use>
				</svg>
			</view>
		</view>

		<view class="card">
			<text class="hint">这里设置的是各分类的默认保质期天数，后续自动计算会按此值，可在具体条目中再调整。</text>
			<view v-for="cat in categories" :key="cat" class="rule-row">
				<view class="rule-main">
					<view class="cat-ico">
						<IngredientIcon :name="cat" :category="cat" :size="34" />
					</view>
					<text class="cat">{{ cat }}</text>
				</view>
				<picker :range="dayOptions" :value="getValueIndex(cat)" @change="onRulePick(cat, $event)">
					<view class="days-inline">
						<text class="day-box">{{ values[cat] }}</text>
						<text class="suf">天</text>
					</view>
				</picker>
			</view>
		</view>

		<view class="action-row">
			<button class="btn ghost" @click="resetDefaults">恢复默认</button>
			<button class="btn primary" @click="save">保存设置</button>
		</view>
	</view>
</template>

<script>
import IngredientIcon from '@/components/ingredient-icon.vue'
import { getShelfLifeSettings, updateShelfLifeSettings } from '@/api/modules/shelf-life'
import { DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY, normalizeShelfLifeDaysByCategory } from '@/utils/shelf-life'

export default {
	components: { IngredientIcon },
	data() {
		return {
			userId: 1,
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			dayOptions: Array.from({ length: 365 }, (_, i) => i + 1),
			values: { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
		}
	},
	async onShow() {
		await this.loadSettings()
	},
	methods: {
		async loadSettings() {
			try {
				const res = await getShelfLifeSettings(this.userId)
				const rules = res?.rules || res?.data?.rules || {}
				this.values = normalizeShelfLifeDaysByCategory(rules)
			} catch (e) {
				this.values = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
				uni.showToast({ title: '读取配置失败，已使用默认值', icon: 'none' })
			}
		},
		goBack() {
			uni.navigateBack()
		},
		getValueIndex(category) {
			const value = Number(this.values[category] || 1)
			const idx = this.dayOptions.findIndex((x) => Number(x) === value)
			return idx >= 0 ? idx : 0
		},
		onRulePick(category, e) {
			const idx = Number(e?.detail?.value)
			const picked = Number(this.dayOptions[idx] || 1)
			this.values = {
				...this.values,
				[category]: Math.min(Math.max(Math.round(picked), 1), 3650)
			}
		},
		resetDefaults() {
			this.values = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
			uni.showToast({ title: '已恢复默认', icon: 'none' })
		},
		async save() {
			try {
				const normalized = normalizeShelfLifeDaysByCategory(this.values)
				const defaultDays = Number(normalized?.其他 || 7)
				const res = await updateShelfLifeSettings({
					userId: this.userId,
					defaultDays,
					rules: normalized
				})
				const rules = res?.rules || res?.data?.rules || normalized
				this.values = normalizeShelfLifeDaysByCategory(rules)
				uni.showToast({ title: '保存成功', icon: 'success' })
			} catch (e) {
				uni.showToast({ title: '保存失败，请重试', icon: 'none' })
			}
		}
	}
}
</script>

<style scoped>
.container { padding: 10px 12px 20px; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.capsule { border: 1rpx solid #e2e9e4; border-radius: 999rpx; background: #fff; min-width: 88rpx; height: 56rpx; padding: 0 16rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.back-ico-svg { width: 20px; height: 20px; display: block; }

.card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 16px; padding: 12px; margin-bottom: 10rpx; box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07); }
.rule-row { display: flex; align-items: center; justify-content: space-between; min-height: 92rpx; padding: 8rpx 0; border-top: 1rpx solid #eef3f1; }
.rule-row:first-of-type { border-top: none; }
.rule-main { display: inline-flex; align-items: center; gap: 10rpx; }
.cat-ico { width: 44px; height: 44px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: #ffffff; }
.cat { font-size: 16px; font-weight: 600; color: #233229; }
.hint { display: block; margin-bottom: 6rpx; font-size: 11px; color: #8d9c93; line-height: 1.5; }
.days-inline { display: inline-flex; align-items: center; gap: 6rpx; }
.suf { font-size: 14px; color: #28372e; }
.day-box { min-width: 50rpx; height: 46rpx; border-radius: 10px; border: 1rpx solid #dcebe1; background: #f6fcf8; display: inline-flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #6ebf85; padding: 0 8rpx; box-sizing: border-box; }

.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 8rpx; }
.btn { width: 100%; border-radius: 999rpx; font-size: 13px; font-weight: 700; height: 42px; line-height: 42px; }
.btn.ghost { background: #ecf1ed; color: #637268; }
.btn.primary { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.26); }
.btn::after { border: none; }
</style>
