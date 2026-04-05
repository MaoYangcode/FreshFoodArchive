<template>
	<view class="container">
		<view class="top">
			<text class="top-title">添加食材</text>
			<view class="capsule"><text>•••</text><text>◉</text></view>
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

		<view v-if="batchVisible" class="card batch-card">
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
								<text class="step-btn" @click="decreaseBatchQty(idx)">-</text>
								<text class="step-val">{{ getBatchQuantity(item) }}</text>
								<text class="step-btn" @click="increaseBatchQty(idx)">+</text>
							</view>
							<picker :range="units" @change="onBatchUnitChange(idx, $event)">
								<text class="batch-unit">{{ item.unit || '单位' }}</text>
							</picker>
						</view>
						<view class="batch-line2">
							<picker :range="locations" @change="onBatchLocationChange(idx, $event)">
								<view class="batch-meta">
									<text class="batch-meta-txt">{{ item.location || '分区' }}</text>
								</view>
							</picker>
							<picker :range="categories" @change="onBatchCategoryChange(idx, $event)">
								<view class="batch-meta">
									<text class="batch-meta-txt">{{ item.category || '类型' }}</text>
								</view>
							</picker>
							<picker mode="date" :value="item.expireDate" @change="onBatchExpireDateChange(idx, $event)">
								<view class="batch-meta">
									<text class="batch-meta-txt">{{ item.expireDate || '过期时间' }}</text>
								</view>
							</picker>
						</view>
					</view>
				</view>
			</view>
			<button class="submit-btn" :disabled="batchSubmitting" @click="submitBatch">
				{{ batchSubmitting ? '入库中...' : '一键批量入库' }}
			</button>
		</view>

		<view class="card form-card">
			<view class="manual-head">
				<text class="ai-iconfont manual-icon">&#xe698;</text>
				<text class="manual-title">手动添加</text>
			</view>
			<view class="form-row">
				<view class="row-left">
					<text class="row-icon">◍</text>
					<text class="row-label">食物名称</text>
				</view>
				<input v-model="form.name" class="row-input" placeholder="请输入食物名称" placeholder-style="color:#a5b1aa;" />
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
					<text class="row-icon ai-iconfont">&#xe621;</text>
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
	
import { createIngredient } from '@/api/modules/ingredients'
import { recognizeIngredientsByUpload, recognizeReceiptByUpload } from '@/api/modules/ai'
import BottomNav from '@/components/bottom-nav.vue'

export default {
	components: { BottomNav },
	data() {
		return {
			categories: ['水果', '蔬菜', '肉类', '蛋奶', '海鲜', '饮料', '调味品', '其他'],
			units: ['个', '盒', '包', 'g', 'kg', 'ml'],
			locations: ['冷藏', '冷冻'],
			batchVisible: false,
			batchSubmitting: false,
			batchItems: [],
			form: {
				name: '',
				category: '',
				quantity: '',
				unit: '',
				location: '',
				expireDate: ''
			}
		}
	},
	computed: {
		batchSelectedCount() {
			return this.batchItems.filter((item) => item.selected !== false).length
		}
	},
	methods: {
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

				if (list.length > 1) {
					this.batchItems = list.map((item) => this.normalizeRecognizedItem(item))
					this.batchVisible = true
					uni.showToast({ title: `识别到${list.length}条，请确认`, icon: 'none' })
					return
				}

				const first = this.normalizeRecognizedItem(list[0] || {})
				if (!this.form.name && first.name) this.form.name = first.name
				if (!this.form.category && first.category) this.form.category = first.category
				if (!this.form.quantity && first.quantity) this.form.quantity = `${first.quantity}`
				if (!this.form.unit && first.unit) this.form.unit = first.unit
				uni.showToast({ title: `识别到${list.length}种食材`, icon: 'none' })
			} catch (e) {
				console.error('识别失败', e)
				uni.showToast({ title: '识别失败，请重试', icon: 'none' })
			} finally {
				uni.hideLoading()
			}
		},
		normalizeRecognizedItem(item) {
			const category = this.categories.includes(item?.category) ? item.category : '其他'
			const quantity = item?.quantity || item?.quantity === 0 ? `${item.quantity}` : '1'
			return {
				name: item?.name ? `${item.name}` : '',
				category,
				quantity,
				unit: item?.unit ? `${item.unit}` : '个',
				location: this.form.location || '冷藏',
				expireDate: this.form.expireDate || '',
				selected: true
			}
		},
		onBatchCategoryChange(index, e) {
			this.batchItems[index].category = this.categories[e.detail.value]
		},
		onBatchUnitChange(index, e) {
			this.batchItems[index].unit = this.units[e.detail.value]
		},
		onBatchLocationChange(index, e) {
			this.batchItems[index].location = this.locations[e.detail.value]
		},
		onBatchExpireDateChange(index, e) {
			this.batchItems[index].expireDate = e.detail.value
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
						userId: 1
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
					userId: 1
				})
		
				uni.showToast({ title: '保存成功', icon: 'success' })
		
				setTimeout(() => {
					uni.navigateBack({
						delta: 1
					})
				}, 300)
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

.batch-card {
	padding: 12px 10px;
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
	max-height: 520rpx;
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
	border-color: #9cc4ff;
	background: #9cc4ff;
}

.batch-selector-check {
	color: #fff;
	font-size: 10px;
	font-weight: 700;
}

.batch-item {
	flex: 1;
	border: 1rpx solid #e3eee6;
	border-radius: 12px;
	padding: 10px;
	background: #fff;
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
	text-align: center;
	line-height: 28rpx;
	font-size: 18px;
	font-weight: 700;
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
	background: #e9f7ef;
	border: 1rpx solid #cfead9;
	font-size: 13px;
	color: #2e6a4a;
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
	font-family: "add-iconfont" !important;
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
	display: inline-flex;
	align-items: center;
	min-width: 132px;
	flex-shrink: 0;
}

.row-icon {
	color: #6aa97a;
	font-size: 19px;
	width: 30px;
	text-align: center;
	margin-right: 8rpx;
}

.row-label {
	font-size: 14px;
	font-weight: 600;
	color: #26352d;
}

.row-input {
	flex: 1;
	font-size: 13px;
	color: #2e3b33;
	padding: 0 8rpx;
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

.hint {
	font-size: 11px;
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
	font-size: 13px;
}
</style>
