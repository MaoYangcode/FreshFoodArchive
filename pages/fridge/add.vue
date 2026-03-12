<template>
	<view class="container">
		<view class="top">
			<text class="top-title">添加食材</text>
			<view class="capsule"><text>•••</text><text>◉</text></view>
		</view>
		<view class="card">
			<view class="head-row">
				<text class="section-title">食材识别</text>
				<text class="ai-tag">AI智能</text>
			</view>
			<view class="recognize" @click="mockRecognize">
				<text class="camera">📷</text>
				<text class="recognize-title">拍照识别 / 上传图片</text>
				<text class="recognize-meta">AI 自动识别食材</text>
			</view>
		</view>

		<view class="card form-card">
			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◍</text>
					<text class="row-label">食物名称</text>
				</view>
				<input v-model="form.name" class="row-input" placeholder="请输入食物名称" />
				<text class="req side-req">*</text>
			</view>

			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">☰</text>
					<text class="row-label">食材类型</text>
				</view>
				<picker :range="categories" @change="onCategoryChange" class="flex-picker">
					<view class="row-chip">{{ form.category || '请选择类型' }}</view>
				</picker>
				<text class="req side-req">*</text>
			</view>

			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◫</text>
					<text class="row-label">数量</text>
				</view>
				<input v-model="form.quantity" class="qty-input" type="number" placeholder="1" />
				<picker :range="units" @change="onUnitChange">
					<view class="row-chip unit-chip">{{ form.unit || '份' }}</view>
				</picker>
				<text class="req side-req">*</text>
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
				<text class="req side-req">*</text>
			</view>

			<view class="form-row date-row">
				<view class="row-left">
					<text class="row-icon">◷</text>
					<text class="row-label">购买时间</text>
				</view>
				<picker mode="date" :value="form.purchaseDate" @change="onPurchaseDateChange" class="flex-picker">
					<view class="row-date">{{ form.purchaseDate || '选择购买时间（默认当天）' }}</view>
				</picker>
			</view>

			<view class="form-row date-row">
				<view class="row-left">
					<text class="row-icon">◷</text>
					<text class="row-label">过期时间</text>
				</view>
				<picker mode="date" :value="form.expireDate" @change="onDateChange" class="flex-picker">
					<view class="row-date">{{ form.expireDate || '选择过期时间' }}</view>
				</picker>
			</view>
			<text class="hint">提示：过期日期不能早于今天</text>
			<button class="submit-btn" @click="submit">入库</button>
		</view>
		<BottomNav current="add" />
	</view>
</template>

<script>
import { addIngredient } from '@/store/app-store'
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			categories: ['蔬菜', '水果', '肉类', '蛋奶', '调料', '其他'],
			units: ['个', '盒', '包', 'g', 'kg', 'ml'],
			locations: ['冷藏', '冷冻', '常温'],
			form: {
				name: '',
				category: '',
				quantity: '',
				unit: '',
				location: '',
				purchaseDate: '',
				expireDate: ''
			}
		}
	},
	methods: {
		mockRecognize() {
			uni.showToast({ title: '后续接入 AI 识别', icon: 'none' })
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
		onPurchaseDateChange(e) {
			this.form.purchaseDate = e.detail.value
		},
		submit() {
			if (!this.form.name || !this.form.category || !this.form.quantity || !this.form.unit || !this.form.location || !this.form.expireDate) {
				uni.showToast({ title: '请先填写完整信息', icon: 'none' })
				return
			}
			const today = new Date().toISOString().slice(0, 10)
			if (this.form.expireDate < today) {
				uni.showToast({ title: '过期日期不能早于今天', icon: 'none' })
				return
			}
			addIngredient(this.form)
			uni.showToast({ title: '保存成功', icon: 'success' })
			setTimeout(() => {
				uni.switchTab({ url: '/pages/fridge/list' })
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

.section-title {
	font-size: 14px;
	font-weight: 700;
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

.recognize {
	border: 2rpx dashed #c7ddcc;
	border-radius: 20px;
	min-height: 230rpx;
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	background: #fbfdfb;
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

.form-card {
	padding: 10px;
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
	display: inline-flex;
	align-items: center;
	min-width: 132px;
	flex-shrink: 0;
}

.row-icon {
	color: #6aa97a;
	font-size: 18px;
	width: 30px;
	text-align: center;
	margin-right: 8rpx;
}

.row-label {
	font-size: 15px;
	font-weight: 600;
	color: #26352d;
}

.row-input {
	flex: 1;
	font-size: 14px;
	color: #2e3b33;
	padding: 0 8rpx;
}

.side-req {
	font-size: 18px;
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
	font-size: 14px;
	font-weight: 600;
}

.qty-input {
	flex: 1;
	font-size: 14px;
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
	font-size: 14px;
	color: #2d3a32;
}

.dot {
	width: 26px;
	height: 26px;
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
	font-size: 14px;
	font-weight: 700;
}

.date-row {
	background: #f4f8f5;
}

.row-date {
	font-size: 14px;
	color: #7c8880;
	padding-left: 6rpx;
}

.hint {
	font-size: 12px;
	color: #88958d;
	margin: 2rpx 0 8rpx;
	display: block;
}

.submit-btn {
	background: linear-gradient(135deg, #70c977, #4cae57);
	color: #fff;
	border-radius: 999rpx;
	margin-top: 10rpx;
	font-weight: 700;
	font-size: 14px;
}
</style>
