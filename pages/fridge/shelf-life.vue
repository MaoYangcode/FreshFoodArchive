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
			<text class="card-title">分类默认保质期（天）</text>
			<view class="grid">
				<view v-for="cat in categories" :key="cat" class="row">
					<text class="label">{{ cat }}</text>
					<input
						class="input"
						type="number"
						:value="values[cat]"
						@input="onInput(cat, $event)"
					/>
				</view>
			</view>
			<view class="actions">
				<button class="btn reset" @click="resetDefaults">恢复默认</button>
				<button class="btn save" @click="save">保存配置</button>
			</view>
		</view>
	</view>
</template>

<script>
import { DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY, getShelfLifeDaysByCategory, setShelfLifeDaysByCategory } from '@/utils/shelf-life'

export default {
	data() {
		return {
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			values: getShelfLifeDaysByCategory()
		}
	},
	onShow() {
		this.values = getShelfLifeDaysByCategory()
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		onInput(category, e) {
			const raw = e && e.detail ? `${e.detail.value || ''}` : ''
			const n = Math.floor(Number(raw))
			if (!Number.isFinite(n) || n <= 0) {
				this.values[category] = DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY[category] || 7
				return
			}
			this.values[category] = Math.min(n, 3650)
		},
		resetDefaults() {
			this.values = { ...DEFAULT_SHELF_LIFE_DAYS_BY_CATEGORY }
			uni.showToast({ title: '已恢复默认', icon: 'none' })
		},
		save() {
			this.values = setShelfLifeDaysByCategory(this.values)
			uni.showToast({ title: '保存成功', icon: 'success' })
		}
	}
}
</script>

<style scoped>
.container { padding: 10px 12px 20px; }
.top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.capsule { border: 1rpx solid #e2e9e4; border-radius: 999rpx; background: #fff; min-width: 88rpx; height: 56rpx; padding: 0 16rpx; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.back-ico-svg { width: 20px; height: 20px; display: block; }
.card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 16px; padding: 12px; }
.card-title { display: block; font-size: 14px; font-weight: 700; color: #24362b; margin-bottom: 10rpx; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx 12rpx; }
.row { display: flex; align-items: center; gap: 8rpx; }
.label { width: 46rpx; font-size: 12px; color: #6f8176; }
.input { flex: 1; height: 34px; border: 1rpx solid #d8e6dd; border-radius: 10px; background: #fff; text-align: center; font-size: 13px; color: #2f3f36; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 12rpx; }
.btn { border-radius: 999rpx; font-size: 13px; font-weight: 700; height: 40px; line-height: 40px; }
.btn.reset { background: #e8efea; color: #5f7266; }
.btn.save { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.24); }
.btn::after { border: none; }
</style>
