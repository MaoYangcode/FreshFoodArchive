<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back-left" @click="goBack">
				<text class="back-arrow">‹</text>
			</view>
			<text class="top-title">取出记录</text>
		</view>
		<view v-if="records.length > 0" class="filter-card">
			<view class="range-inline">
				<text class="range-label">取出时间：</text>
				<picker mode="date" :value="startDate" @change="onStartDateChange">
					<view class="range-btn">{{ startDate || '开始日期' }}</view>
				</picker>
				<text class="range-sep">~</text>
				<picker mode="date" :value="endDate" @change="onEndDateChange">
					<view class="range-btn">{{ endDate || '结束日期' }}</view>
				</picker>
			</view>
			<view class="quick-row">
				<view class="quick-chip" :class="{ active: quickRange === 'all' }" @click="applyQuickRange('all')">全部</view>
				<view class="quick-chip" :class="{ active: quickRange === '7d' }" @click="applyQuickRange('7d')">近7天</view>
				<view class="quick-chip" :class="{ active: quickRange === '30d' }" @click="applyQuickRange('30d')">近30天</view>
			</view>
		</view>
		<view v-if="filteredRecords.length === 0" class="card">
			<text class="meta">{{ records.length === 0 ? '暂无记录，右滑食材并点击“已取出”后会显示在这里。' : '当前时间范围内暂无记录，可切换到“全部”查看。' }}</text>
		</view>
		<view class="row" v-for="record in filteredRecords" :key="record.id">
			<view class="ico">
				<IngredientIcon :name="record.name" :category="record.category" :size="36" />
			</view>
			<view class="body">
				<text class="name">{{ record.name }}</text>
				<view class="meta">
					<text>{{ record.quantity }}{{ record.unit }} · </text>
					<LocationIcon :location="record.location" :size="13" color="#8fb7e8" />
					<text>{{ record.location }}</text>
				</view>
			</view>
			<view class="time-wrap">
				<text class="time-label">取出时间</text>
				<text class="time-value">{{ formatDateTime(record.time) }}</text>
			</view>
		</view>
		<BottomNav current="profile" />
	</view>
</template>

<script>
	
import { getTakeoutRecords } from '@/api/modules/ingredients'
import BottomNav from '@/components/bottom-nav.vue'
import IngredientIcon from '@/components/ingredient-icon.vue'
import LocationIcon from '@/components/location-icon.vue'

export default {
	components: { BottomNav, IngredientIcon, LocationIcon },
	data() {
		return {
			records: [],
			startDate: '',
			endDate: '',
			quickRange: 'all'
		}
	},
	computed: {
		filteredRecords() {
			const start = this.startDate
			const end = this.endDate
			return this.records.filter((record) => {
				const day = this.extractDay(record.time)
				if (!day) return false
				if (start && day < start) return false
				if (end && day > end) return false
				return true
			})
		}
	},
	async onShow() {
	  try {
	    const res = await getTakeoutRecords()
	    this.records = Array.isArray(res)
	      ? res
	      : (Array.isArray(res?.data) ? res.data : (Array.isArray(res?.data?.data) ? res.data.data : []))
	  } catch (e) {
	    this.records = []
	    uni.showToast({ title: '加载记录失败', icon: 'none' })
	  }
	},
	methods: {
		goBack() {
			uni.navigateBack()
		},
		formatDateTime(time) {
			if (!time) return '--'
			const date = new Date(time)
			if (Number.isFinite(date.getTime())) {
				const pad = (n) => `${n}`.padStart(2, '0')
				const y = date.getFullYear()
				const m = pad(date.getMonth() + 1)
				const d = pad(date.getDate())
				const hh = pad(date.getHours())
				const mm = pad(date.getMinutes())
				return `${y}-${m}-${d} ${hh}:${mm}`
			}
			const text = `${time}`
			if (text.includes('T')) return text.replace('T', ' ').slice(0, 16)
			return text.slice(0, 16)
		},
		extractDay(time) {
			if (!time) return ''
			const date = new Date(time)
			if (Number.isFinite(date.getTime())) {
				const pad = (n) => `${n}`.padStart(2, '0')
				const y = date.getFullYear()
				const m = pad(date.getMonth() + 1)
				const d = pad(date.getDate())
				return `${y}-${m}-${d}`
			}
			const text = `${time}`
			if (text.includes('T')) return text.slice(0, 10)
			return text.slice(0, 10)
		},
		onStartDateChange(e) {
			this.startDate = e.detail.value
			this.quickRange = 'custom'
			if (this.endDate && this.startDate > this.endDate) {
				this.endDate = this.startDate
			}
		},
		onEndDateChange(e) {
			this.endDate = e.detail.value
			this.quickRange = 'custom'
			if (this.startDate && this.endDate < this.startDate) {
				this.startDate = this.endDate
			}
		},
		applyQuickRange(type) {
			this.quickRange = type
			if (type === 'all') {
				this.startDate = ''
				this.endDate = ''
				return
			}
			const today = new Date()
			const pad = (n) => `${n}`.padStart(2, '0')
			const format = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
			const end = new Date(today)
			const start = new Date(today)
			start.setDate(today.getDate() - (type === '7d' ? 6 : 29))
			this.startDate = format(start)
			this.endDate = format(end)
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
	align-items: center;
	gap: 10rpx;
	margin-bottom: 8rpx;
}

.top-title {
	font-size: 20px;
	font-weight: 700;
}

.back-left { width: 30px; height: 30px; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; }
.back-arrow { font-size: 30px; line-height: 1; color: #c7ced9; transform: translateY(-1px); }

.card {
	background: #fff;
	border: 1rpx solid #edf2ef;
	border-radius: 14px;
	padding: 10px;
}

.filter-card {
	background: #fff;
	border: 1rpx solid #e8edf0;
	border-radius: 14px;
	padding: 10px;
	margin-bottom: 10rpx;
}

.range-inline {
	display: flex;
	align-items: center;
	gap: 8rpx;
	flex-wrap: wrap;
}

.range-label {
	font-size: 13px;
	font-weight: 600;
	color: #536173;
}

.range-btn {
	min-width: 160rpx;
	text-align: center;
	background: #f3f7fb;
	border: 1rpx solid #e2e8ef;
	border-radius: 999rpx;
	padding: 8rpx 12rpx;
	font-size: 12px;
	color: #5d6775;
}

.range-sep {
	color: #9aa4b2;
	font-size: 13px;
}

.quick-row {
	display: flex;
	gap: 8rpx;
	margin-top: 8rpx;
}

.quick-chip {
	background: #f3f6f8;
	color: #6b7583;
	border: 1rpx solid #e6ebef;
	border-radius: 999rpx;
	padding: 4rpx 12rpx;
	font-size: 11px;
}

.quick-chip.active {
	background: #e8f0ff;
	color: #4a73d9;
	border-color: #d9e5ff;
}

.row {
	display: grid;
	grid-template-columns: 40px 1fr auto;
	gap: 10rpx;
	align-items: start;
	border: 1rpx solid #eef3f0;
	border-radius: 14px;
	padding: 9px;
	background: #fbfdfb;
	margin-bottom: 10rpx;
}

.ico {
	width: 40px;
	height: 40px;
	border-radius: 12px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: #f1f8f2;
	font-size: 20px;
}

.name {
	display: block;
	font-size: 14px;
	font-weight: 700;
}

.body {
	min-width: 0;
}

.meta {
	display: inline-flex;
	align-items: center;
	gap: 4rpx;
	font-size: 12px;
	color: #738177;
	margin-top: 4rpx;
}

.time-wrap {
	display: flex;
	flex-direction: column;
	align-items: flex-end;
	padding-top: 2rpx;
}

.time-label {
	font-size: 11px;
	color: #93a198;
}

.time-value {
	margin-top: 4rpx;
	font-size: 12px;
	color: #3f9f4d;
	background: #e9f8ec;
	border-radius: 999rpx;
	padding: 4rpx 10rpx;
}
</style>
