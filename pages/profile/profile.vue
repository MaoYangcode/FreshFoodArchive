<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back-left" @click="goBack">
				<text class="back-arrow">‹</text>
			</view>
			<text class="top-title">我的资料</text>
		</view>

		<view class="hero-bg">
			<view class="avatar-wrap" @click="pickAvatar">
				<view class="avatar-box">
					<image v-if="avatarSrc" class="avatar-img" :src="avatarSrc" mode="aspectFill" />
					<text v-else class="profile-iconfont avatar-fallback-ico">&#xe615;</text>
				</view>
			</view>
		</view>

		<view class="card white-card">
			<view class="row first-row">
				<text class="label">昵称</text>
				<input v-model="form.name" class="field-input row-input" maxlength="20" placeholder="请输入昵称" />
			</view>
			<view class="row">
				<text class="label">家庭人数</text>
				<view class="right-wrap">
					<picker mode="selector" :range="householdOptions" @change="onHouseholdChange">
						<view class="pill">{{ form.householdSize }}人</view>
					</picker>
				</view>
			</view>
		</view>

		<view class="card white-card">
			<text class="section-title">饮食偏好</text>
			<view class="chip-wrap">
				<view
					v-for="item in dietOptions"
					:key="item"
					class="chip"
					:class="{ on: form.dietPreferences.includes(item) }"
					@click="toggleListValue('dietPreferences', item)"
				>
					{{ item }}
				</view>
			</view>
			<view class="sub-section">
				<text class="section-title sub">忌口与限制</text>
				<view class="chip-wrap">
					<view
						v-for="item in avoidanceOptions"
						:key="item"
						class="chip"
						:class="{ on: form.avoidances.includes(item) }"
						@click="toggleListValue('avoidances', item)"
					>
						{{ item }}
					</view>
				</view>
			</view>
		</view>

		<view class="card white-card">
			<text class="section-title">可用厨具</text>
			<view class="chip-wrap">
				<view
					v-for="item in cookwareOptions"
					:key="item"
					class="chip"
					:class="{ on: form.cookware.includes(item) }"
					@click="toggleListValue('cookware', item)"
				>
					{{ item }}
				</view>
			</view>
		</view>

		<view class="action-row">
			<button class="btn ghost" @click="resetDefaults">恢复默认</button>
			<button class="btn primary" @click="saveProfile">保存资料</button>
		</view>

		<BottomNav current="profile" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { getProfile, updateProfile } from '@/api/modules/profile'
import { getCurrentUserId } from '@/utils/current-user'

const DEFAULT_FORM = {
	name: '微信用户',
	avatar: '',
	householdSize: 2,
	dietPreferences: [],
	avoidances: [],
	cookware: [],
	note: ''
}

function cloneDefaultForm() {
	return JSON.parse(JSON.stringify(DEFAULT_FORM))
}

export default {
	components: { BottomNav },
	data() {
		return {
			userId: getCurrentUserId(),
			householdOptions: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
			dietOptions: ['清淡', '低脂', '高蛋白', '少糖', '少盐', '增肌'],
			avoidanceOptions: ['海鲜', '花生', '乳糖', '辛辣', '香菜', '葱姜蒜'],
			cookwareOptions: ['空气炸锅', '电饭煲', '烤箱', '炒锅', '蒸锅', '微波炉'],
			form: cloneDefaultForm(),
			avatarPreview: '',
			avatarDataForSave: ''
		}
	},
	computed: {
		avatarText() {
			const text = `${this.form.name || ''}`.trim()
			return text ? text.slice(0, 1) : '我'
		},
		avatarSrc() {
			const preview = `${this.avatarPreview || ''}`.trim()
			if (preview) return preview
			return `${this.form.avatar || ''}`.trim()
		}
	},
	onLoad() {
		this.userId = getCurrentUserId()
		this.loadProfile()
	},
	methods: {
		goBack() {
			uni.switchTab({ url: '/pages/profile/index' })
		},
		normalizeArray(value) {
			return Array.isArray(value) ? value.map((x) => `${x || ''}`.trim()).filter(Boolean) : []
		},
		parseCookware(text) {
			return `${text || ''}`
				.split(/[、,，\s]+/)
				.map((x) => `${x || ''}`.trim())
				.filter(Boolean)
		},
		async loadProfile() {
			try {
				const res = await getProfile(this.userId)
				if (!res || typeof res !== 'object') {
					this.form = cloneDefaultForm()
					return
				}
				this.form = {
					name: `${res.name || DEFAULT_FORM.name}`.trim() || DEFAULT_FORM.name,
					avatar: `${res.avatar || ''}`.trim(),
					householdSize: Number(res.householdSize || DEFAULT_FORM.householdSize),
					dietPreferences: this.normalizeArray(res.dietPreferences),
					avoidances: this.normalizeArray(res.avoidances),
					cookware: this.parseCookware(res.note),
					note: `${res.note || ''}`.trim()
				}
				this.avatarPreview = `${this.form.avatar || ''}`.trim()
				this.avatarDataForSave = ''
			} catch (e) {
				this.form = cloneDefaultForm()
				this.avatarPreview = ''
				this.avatarDataForSave = ''
				uni.showToast({ title: '资料加载失败', icon: 'none' })
			}
		},
		onHouseholdChange(e) {
			const idx = Number(e?.detail?.value)
			const picked = this.householdOptions[idx]
			this.form.householdSize = Number(picked || DEFAULT_FORM.householdSize)
		},
		readAsDataUrl(path) {
			return new Promise((resolve, reject) => {
				const fs = uni.getFileSystemManager && uni.getFileSystemManager()
				if (!fs || !fs.readFile) {
					reject(new Error('readFile not available'))
					return
				}
				const ext = `${path}`.split('.').pop()?.toLowerCase() || ''
				let mime = 'image/jpeg'
				if (ext === 'png') mime = 'image/png'
				if (ext === 'webp') mime = 'image/webp'
				if (ext === 'gif') mime = 'image/gif'
				fs.readFile({
					filePath: path,
					encoding: 'base64',
					success: (res) => {
						resolve(`data:${mime};base64,${res.data || ''}`)
					},
					fail: (e) => reject(e)
				})
			})
		},
		compressAvatar(path) {
			return new Promise((resolve) => {
				if (!path || typeof uni.compressImage !== 'function') {
					resolve(path)
					return
				}
				uni.compressImage({
					src: path,
					quality: 50,
					compressedWidth: 320,
					compressedHeight: 320,
					success: (res) => {
						resolve(res?.tempFilePath || path)
					},
					fail: () => {
						resolve(path)
					}
				})
			})
		},
		pickAvatar() {
			uni.chooseImage({
				count: 1,
				sizeType: ['compressed'],
				success: async (res) => {
					const path = res?.tempFilePaths?.[0]
					if (!path) return
					this.avatarPreview = path
					this.avatarDataForSave = ''
					try {
						const compressedPath = await this.compressAvatar(path)
						const dataUrl = await this.readAsDataUrl(compressedPath || path)
						const normalized = `${dataUrl || ''}`.trim()
						if (!normalized.startsWith('data:image/')) {
							throw new Error('invalid avatar data')
						}
						this.form.avatar = normalized
						this.avatarDataForSave = normalized
					} catch (e) {
						uni.showToast({ title: '已选头像，保存时将再次处理', icon: 'none' })
					}
				}
			})
		},
		async resolveAvatarForSave() {
			const direct = `${this.avatarDataForSave || this.form.avatar || ''}`.trim()
			if (direct.startsWith('data:image/')) return direct
			const preview = `${this.avatarPreview || ''}`.trim()
			if (!preview) return ''
			try {
				const dataUrl = await this.readAsDataUrl(preview)
				const normalized = `${dataUrl || ''}`.trim()
				if (normalized.startsWith('data:image/')) return normalized
			} catch (e) {}
			return ''
		},
		toggleListValue(field, value) {
			const current = Array.isArray(this.form[field]) ? this.form[field] : []
			if (current.includes(value)) {
				this.form[field] = current.filter((x) => x !== value)
				return
			}
			this.form[field] = [...current, value]
		},
		resetDefaults() {
			this.form = cloneDefaultForm()
			this.avatarPreview = ''
			this.avatarDataForSave = ''
			uni.showToast({ title: '已恢复默认', icon: 'none' })
		},
		async saveProfile() {
			const avatarToSave = await this.resolveAvatarForSave()
			const currentSavedAvatar = `${this.form.avatar || ''}`.trim()
			const safeAvatar = avatarToSave || (currentSavedAvatar.startsWith('data:image/') ? currentSavedAvatar : '')
			const payload = {
				userId: this.userId,
				name: `${this.form.name || ''}`.trim() || DEFAULT_FORM.name,
				avatar: safeAvatar,
				householdSize: Number(this.form.householdSize || DEFAULT_FORM.householdSize),
				dietPreferences: this.normalizeArray(this.form.dietPreferences),
				avoidances: this.normalizeArray(this.form.avoidances),
				note: this.normalizeArray(this.form.cookware).join('、')
			}
			try {
				const saved = await updateProfile(payload)
				this.form = {
					name: `${saved?.name || payload.name}`.trim() || DEFAULT_FORM.name,
					avatar: `${saved?.avatar || payload.avatar || ''}`.trim(),
					householdSize: Number(saved?.householdSize || payload.householdSize),
					dietPreferences: this.normalizeArray(saved?.dietPreferences || payload.dietPreferences),
					avoidances: this.normalizeArray(saved?.avoidances || payload.avoidances),
					cookware: this.parseCookware(saved?.note || payload.note),
					note: `${saved?.note || payload.note}`.trim()
				}
				this.avatarPreview = `${this.form.avatar || ''}`.trim()
				this.avatarDataForSave = `${this.form.avatar || ''}`.trim()
				uni.showToast({ title: '资料已更新', icon: 'success' })
			} catch (e) {
				uni.showToast({ title: '保存失败，请重试', icon: 'none' })
			}
		}
	}
}
</script>

<style scoped>

.container { padding: 10px 12px 88px; background: #f4f6f8; }
.top { display: flex; align-items: center; gap: 10rpx; margin-bottom: 12rpx; }
.top-title { font-size: 20px; font-weight: 700; }
.back-left { width: 30px; height: 30px; border-radius: 999rpx; display: inline-flex; align-items: center; justify-content: center; }
.back-arrow { font-size: 30px; line-height: 1; color: #c7ced9; transform: translateY(-1px); }

.hero-bg { padding: 16rpx 10px 14rpx; display: flex; align-items: center; justify-content: center; margin-bottom: 10rpx; }
.avatar-wrap { position: relative; }
.card { margin-bottom: 22rpx; }
.white-card { background: #fff; border: 1rpx solid #edf2ef; border-radius: 16px; padding: 12px; box-shadow: 0 8rpx 18rpx rgba(30, 50, 34, 0.07); }
.avatar-box { width: 108px; height: 108px; border-radius: 50%; background: #eaf7ee; display: flex; align-items: center; justify-content: center; }
.avatar-img { width: 100%; height: 100%; border-radius: 50%; display: block; }
.profile-iconfont { font-family: "iconfont" !important; font-style: normal; font-weight: 400; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.avatar-fallback-ico { font-size: 76px; color: #34a853; line-height: 1; }

.row { display: flex; align-items: center; justify-content: space-between; min-height: 64rpx; border-top: 1rpx solid #e6ede9; }
.first-row { border-top: none; }
.label { font-size: 14px; font-weight: 700; color: #26352d; }
.field-input { flex: 1; text-align: right; font-size: 13px; color: #2f3f36; }
.row-input { text-align: right; font-size: 14px; font-weight: 500; color: #5f7a6b; }
.right-wrap { flex: 1; display: flex; justify-content: flex-end; }
.pill { min-width: 92rpx; text-align: center; background: #edf5ef; color: #408a4d; border-radius: 999rpx; padding: 6rpx 12rpx; font-size: 12px; font-weight: 700; }

.section-title { display: block; font-size: 14px; font-weight: 700; color: #26352d; margin-bottom: 8rpx; }
.section-title.sub { margin-top: 12rpx; }
.sub-section { margin-top: 8rpx; border-top: 1rpx solid #eef3f1; padding-top: 10rpx; }
.chip-wrap { display: flex; gap: 8rpx; flex-wrap: wrap; }
.chip { border-radius: 999rpx; border: 1rpx solid #e4e9e6; background: #f7faf8; color: #6c7a72; padding: 6rpx 14rpx; font-size: 12px; }
.chip.on { background: #e9f8ec; border-color: #d5eedc; color: #3f9f4d; font-weight: 700; }

.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12rpx; margin-top: 18rpx; }
.btn { width: 100%; border-radius: 999rpx; font-size: 13px; font-weight: 700; height: 42px; line-height: 42px; }
.btn.ghost { background: #ecf1ed; color: #637268; }
.btn.primary { background: linear-gradient(135deg, #70c977, #4cae57); color: #fff; box-shadow: 0 8rpx 16rpx rgba(76, 174, 87, 0.26); }
.btn::after { border: none; }
</style>
