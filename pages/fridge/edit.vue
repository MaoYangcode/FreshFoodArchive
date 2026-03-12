<template>
	<view class="container">
		<view class="top">
			<text class="top-title">编辑食材</text>
			<view class="capsule"><text>🖊</text></view>
		</view>
		<view class="card top-card">
			<view class="food-ico">{{ getEmoji(form.category) }}</view>
			<view>
				<text class="food-name">{{ form.name || '食材' }}</text>
				<text class="food-time">{{ form.createdAt || '-' }}</text>
			</view>
		</view>

		<view class="card">
			<view class="field">
				<text class="label">食材名称<text class="req">*</text></text>
				<input v-model="form.name" class="input" />
			</view>
			<view class="field">
				<text class="label">食材类型<text class="req">*</text></text>
				<picker :range="categories" @change="onCategoryChange">
					<view class="picker">{{ form.category }}</view>
				</picker>
			</view>
			<view class="field two-col">
				<view class="half">
					<text class="label">数量<text class="req">*</text></text>
					<input v-model="form.quantity" class="input" type="number" />
				</view>
				<view class="half">
					<text class="label">单位<text class="req">*</text></text>
					<picker :range="units" @change="onUnitChange">
						<view class="picker">{{ form.unit }}</view>
					</picker>
				</view>
			</view>
			<view class="field">
				<text class="label">位置<text class="req">*</text></text>
				<view class="radio-row">
					<view
						v-for="loc in locations"
						:key="loc"
						class="radio-opt"
						:class="{ active: form.location === loc }"
						@click="form.location = loc"
					>
						<text class="dot"></text>{{ loc }}
					</view>
				</view>
			</view>
			<view class="field">
				<text class="label">过期日期<text class="req">*</text></text>
				<picker mode="date" :value="form.expireDate" @change="onDateChange">
					<view class="picker">{{ form.expireDate }}</view>
				</picker>
				<text class="hint">提示：如修改为今天之前会被拦截</text>
			</view>
		</view>

		<view class="grid2">
			<button class="del-btn" @click="remove">删除</button>
			<button class="save-btn" @click="save">更新</button>
		</view>
		<BottomNav current="fridge" />
	</view>
</template>

<script>
import { deleteIngredient, getIngredientById, updateIngredient } from '@/store/app-store'
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			ingredientId: '',
			categories: ['蔬菜', '水果', '肉类', '蛋奶', '调料', '其他'],
			units: ['个', '盒', '包', 'g', 'kg', 'ml'],
			locations: ['冷藏', '冷冻', '常温'],
			form: {
				name: '西红柿',
				category: '蔬菜',
				quantity: '2',
				unit: '个',
				location: '冷藏',
				expireDate: '2026-03-12'
			}
		}
	},
	onLoad(query) {
		if (query && query.id) {
			this.ingredientId = query.id
			const item = getIngredientById(query.id)
			if (item) {
				this.form = { ...item }
				return
			}
		}
		uni.showToast({ title: '未找到食材，使用默认值', icon: 'none' })
	},
	methods: {
		getEmoji(category) {
			const map = { 蔬菜: '🥦', 水果: '🥑', 肉类: '🥩', 蛋奶: '🥚', 调料: '🧂', 其他: '🍽️' }
			return map[category] || '🍽️'
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
			this.form.expireDate = e.detail.value
		},
		save() {
			const today = new Date().toISOString().slice(0, 10)
			if (this.form.expireDate < today) {
				uni.showToast({ title: '过期日期不能早于今天', icon: 'none' })
				return
			}
			if (!this.ingredientId) {
				uni.showToast({ title: '食材ID缺失', icon: 'none' })
				return
			}
			const ok = updateIngredient(this.ingredientId, this.form)
			if (!ok) {
				uni.showToast({ title: '保存失败', icon: 'none' })
				return
			}
			uni.showToast({ title: '已保存', icon: 'success' })
			setTimeout(() => {
				uni.navigateBack()
			}, 300)
		},
		remove() {
			if (!this.ingredientId) {
				uni.showToast({ title: '食材ID缺失', icon: 'none' })
				return
			}
			const ok = deleteIngredient(this.ingredientId)
			if (!ok) {
				uni.showToast({ title: '删除失败', icon: 'none' })
				return
			}
			uni.showToast({ title: '已删除', icon: 'success' })
			setTimeout(() => {
				uni.navigateBack()
			}, 300)
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

.top-card {
	display: grid;
	grid-template-columns: 86rpx 1fr;
	gap: 12rpx;
	align-items: center;
}

.food-ico {
	width: 86rpx;
	height: 86rpx;
	border-radius: 20rpx;
	background: #f1f8f2;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 46rpx;
}

.food-name {
	font-weight: 700;
	font-size: 14px;
}

.food-time {
	display: block;
	font-size: 12px;
	color: #738177;
	margin-top: 6rpx;
}

.field {
	margin-bottom: 20rpx;
}

.label {
	display: block;
	font-size: 13px;
	font-weight: 600;
	color: #324137;
	margin-bottom: 8rpx;
}

.req {
	color: #e15c5c;
	margin-left: 4rpx;
}

.input,
.picker {
	border: 1rpx solid #e7eceb;
	border-radius: 12px;
	background: #fff;
	padding: 16rpx 18rpx;
}

.two-col {
	display: flex;
	gap: 12rpx;
}

.half {
	flex: 1;
}

.radio-row {
	display: flex;
	align-items: center;
	gap: 18rpx;
	border: 1rpx solid #e7eceb;
	border-radius: 12px;
	background: #fff;
	padding: 14rpx 16rpx;
}

.radio-opt {
	display: inline-flex;
	align-items: center;
	gap: 8rpx;
	font-size: 14px;
	color: #2e3a32;
}

.dot {
	width: 24rpx;
	height: 24rpx;
	border-radius: 50%;
	border: 2rpx solid #d1d9d4;
	background: #fff;
}

.radio-opt.active .dot {
	border-color: #5b8fea;
	background: radial-gradient(circle, #5b8fea 40%, #fff 42%);
}

.hint {
	font-size: 11px;
	color: #8a978f;
	margin-top: 6rpx;
	display: block;
}

.grid2 {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 12rpx;
}

.del-btn {
	background: #f57878;
	color: #fff;
	border-radius: 999rpx;
	font-size: 14px;
}

.save-btn {
	background: linear-gradient(135deg, #70c977, #4cae57);
	color: #fff;
	border-radius: 999rpx;
	font-weight: 700;
	font-size: 14px;
}
</style>
