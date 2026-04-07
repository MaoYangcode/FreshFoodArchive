<template>
	<view class="container">
		<view class="top">
			<text class="top-title">编辑食材</text>
			<view class="capsule" @click="goBackToList">
				<svg class="back-ico-svg" aria-hidden="true">
					<use href="#icon-fanhui"></use>
				</svg>
			</view>
		</view>
		<view class="card top-card">
			<view class="food-ico">
				<IngredientIcon :name="form.name" :category="form.category" :size="54" />
			</view>
			<view>
				<text class="food-name">{{ form.name || '食材' }}</text>
				<text class="food-time">{{ form.createdAt || '-' }}</text>
			</view>
		</view>

		<view class="card form-card">
			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◍</text>
					<text class="row-label">食物名称</text>
				</view>
				<input v-model="form.name" class="row-input" placeholder="请输入食物名称" />
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
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'

export default {
	components: { BottomNav, IngredientIcon },
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
			}
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
		goBackToList() {
			uni.switchTab({
				url: '/pages/fridge/list'
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
@font-face {
	font-family: "add-iconfont";
	src: url('/static/iconfont/iconfont.ttf') format('truetype');
}

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
	min-width: 88rpx;
	height: 56rpx;
	padding: 0 16rpx;
	box-sizing: border-box;
	display: flex;
	align-items: center;
	justify-content: center;
}

.back-ico-svg {
	width: 20px;
	height: 20px;
	display: block;
}

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
	grid-template-columns: 72px 1fr;
	gap: 20rpx;
	align-items: center;
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

.form-card {
	padding: 10px;
}

.ai-iconfont {
	font-family: "add-iconfont" !important;
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
