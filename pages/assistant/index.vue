<template>
	<view class="container" :style="{ paddingTop: `${safeTop + 14}px` }">
		<view class="top">
			<view class="back" @click="goBack"><text class="back-arrow">‹</text></view>
			<view class="top-copy">
				<text class="top-title">语音助手</text>
			</view>
		</view>

		<view class="chat-row assistant-row">
			<view class="chat-avatar">
				<image class="chat-avatar-image" src="/static/assistant/fridge-assistant.png" mode="aspectFit"></image>
			</view>
			<view class="assistant-bubble welcome-bubble">
				<text class="welcome-title">Hi，有什么可以帮你？</text>
				<text class="welcome-text">我可以帮你管理食材、查询库存和推荐菜谱。</text>
			</view>
		</view>

		<view class="examples">
			<text class="section-title">你可以这样说</text>
			<view class="example-list">
				<text v-for="example in examples" :key="example" class="example-chip" @click="tryExample(example)">{{ example }}</text>
			</view>
		</view>

		<view v-if="command" class="conversation">
			<view class="chat-row user-row">
				<view class="user-bubble">
					<text>{{ command.transcript || transcript }}</text>
				</view>
			</view>
			<view class="chat-row assistant-row result-row">
				<view class="chat-avatar small">
					<image class="chat-avatar-image" src="/static/assistant/fridge-assistant.png" mode="aspectFit"></image>
				</view>
				<view class="assistant-bubble result-bubble">
					<view class="result-head">
						<text class="intent-pill" :class="intentTone">{{ intentLabel }}</text>
					</view>
					<text class="assistant-reply">{{ command.reply }}</text>
					<view v-if="command.items && command.items.length" class="command-section">
						<text class="field-label">涉及食材</text>
						<view class="item-list">
							<view v-for="(item, index) in command.items" :key="`${item.name}-${index}`" class="item-row">
								<text class="item-name">{{ item.name }}</text>
								<text class="item-meta">{{ formatItemMeta(item) }}</text>
							</view>
						</view>
					</view>
					<view v-if="recipeSummary" class="command-section">
						<text class="field-label">菜谱条件</text>
						<text class="summary-text">{{ recipeSummary }}</text>
					</view>
					<view class="safety-note">
						<text class="safety-dot"></text>
						<text>{{ command.requiresConfirmation ? '确认无误后才会执行，本阶段暂不修改库存' : '当前先完成理解，后续接入实际查询与朗读' }}</text>
					</view>
				</view>
			</view>
		</view>

		<view class="voice-entry" :class="{ recording: isRecording }" @click="toggleRecording">
			<view class="voice-btn">
				<text class="assistant-iconfont voice-ico">&#xe61f;</text>
			</view>
			<text class="voice-entry-text">{{ isRecording ? '正在听，请说话…' : (isUnderstanding ? '正在理解指令…' : '点击开始说话') }}</text>
		</view>

		<BottomNav current="" />
	</view>
</template>

<script>
import BottomNav from '@/components/bottom-nav.vue'
import { parseAssistantCommand, recognizeAudioByUpload } from '@/api/modules/ai'

export default {
	components: { BottomNav },
	data() {
		return {
			safeTop: 20,
			recorderManager: null,
			isRecording: false,
			isUnderstanding: false,
			transcript: '',
			manualText: '',
			command: null,
			examples: [
				'买了3个番茄放冷藏',
				'今天用了2个鸡蛋',
				'冰箱里还有什么',
				'有什么食材快过期',
				'用番茄推荐一道20分钟的菜'
			]
		}
	},
	computed: {
		intentLabel() {
			const labels = {
				inventory_add: '准备入库',
				inventory_consume: '准备出库',
				inventory_read: '查询库存',
				expiry_read: '查询临期',
				recipe_request: '菜谱请求',
				unknown: '需要确认'
			}
			return labels[this.command?.intent] || '需要确认'
		},
		intentTone() {
			if (this.command?.intent === 'inventory_add') return 'green'
			if (this.command?.intent === 'inventory_consume') return 'orange'
			if (this.command?.intent === 'unknown') return 'gray'
			return 'blue'
		},
		recipeSummary() {
			if (this.command?.intent !== 'recipe_request') return ''
			const recipe = this.command?.recipe || {}
			const parts = []
			if (Array.isArray(recipe.ingredients) && recipe.ingredients.length) parts.push(`食材：${recipe.ingredients.join('、')}`)
			if (recipe.maxDuration) parts.push(`${recipe.maxDuration}分钟内`)
			if (recipe.difficulty) parts.push(recipe.difficulty)
			if (recipe.taste) parts.push(recipe.taste)
			return parts.join(' · ') || '未指定额外条件'
		}
	},
	onLoad() {
		try {
			const info = uni.getSystemInfoSync()
			const top = Number(info?.statusBarHeight || 0)
			if (Number.isFinite(top) && top > 0) this.safeTop = top
		} catch (_) {}
		this.initRecorder()
	},
	onUnload() {
		if (this.isRecording && this.recorderManager) this.recorderManager.stop()
	},
	methods: {
		initRecorder() {
			if (typeof uni.getRecorderManager !== 'function') return
			const manager = uni.getRecorderManager()
			if (!manager || typeof manager.start !== 'function') return
			manager.onStop((res) => this.handleRecordStop(res))
			manager.onError(() => {
				this.isRecording = false
				this.isUnderstanding = false
				uni.hideLoading()
				uni.showToast({ title: '录音失败，请重试', icon: 'none' })
			})
			this.recorderManager = manager
		},
		toggleRecording() {
			if (this.isUnderstanding) return
			if (!this.recorderManager) {
				uni.showToast({ title: '当前环境不支持录音', icon: 'none' })
				return
			}
			if (this.isRecording) {
				this.isUnderstanding = true
				uni.showLoading({ title: '正在理解…' })
				this.recorderManager.stop()
				return
			}
			this.command = null
			this.isRecording = true
			this.recorderManager.start({
				duration: 20000,
				sampleRate: 16000,
				numberOfChannels: 1,
				encodeBitRate: 96000,
				format: 'mp3'
			})
		},
		async handleRecordStop(res) {
			this.isRecording = false
			const filePath = res?.tempFilePath
			if (!filePath) {
				this.isUnderstanding = false
				uni.hideLoading()
				uni.showToast({ title: '没有录到声音', icon: 'none' })
				return
			}
			try {
				const recognized = await recognizeAudioByUpload(filePath)
				const text = `${recognized?.data?.text || ''}`.trim()
				if (!text) throw new Error('没有识别到语音内容')
				this.transcript = text
				this.manualText = text
				await this.parseText(text)
			} catch (error) {
				const message = `${error?.message || error?.errMsg || ''}`.trim()
				uni.showToast({ title: message || '语音理解失败，请重试', icon: 'none' })
			} finally {
				this.isUnderstanding = false
				uni.hideLoading()
			}
		},
		async parseText(text) {
			const value = `${text || ''}`.trim()
			if (!value) return
			this.isUnderstanding = true
			const result = await parseAssistantCommand(value)
			this.command = result?.data?.command || null
			this.transcript = value
		},
		async parseManualText() {
			if (this.isUnderstanding) return
			const value = `${this.manualText || ''}`.trim()
			if (!value) return
			uni.showLoading({ title: '正在理解…' })
			try {
				await this.parseText(value)
			} catch (error) {
				uni.showToast({ title: `${error?.message || '指令解析失败'}`, icon: 'none' })
			} finally {
				this.isUnderstanding = false
				uni.hideLoading()
			}
		},
		tryExample(example) {
			this.manualText = example
			this.parseManualText()
		},
		formatItemMeta(item) {
			const parts = []
			if (item?.quantity) parts.push(`${item.quantity}${item.unit || ''}`)
			if (item?.category) parts.push(item.category)
			if (item?.location) parts.push(item.location)
			if (item?.expireDate) parts.push(item.expireDate)
			return parts.join(' · ') || '信息待补充'
		},
		goBack() {
			const pages = getCurrentPages()
			if (Array.isArray(pages) && pages.length > 1) {
				uni.navigateBack()
				return
			}
			uni.reLaunch({ url: '/pages/home/index' })
		}
	}
}
</script>

<style scoped>
.container {
	min-height: 100vh;
	padding: 0 14px 176px;
	background: #f4f6f5;
}
.top { display: flex; align-items: center; gap: 8rpx; margin-bottom: 18rpx; }
.back { width: 30px; height: 34px; display: flex; align-items: center; justify-content: center; }
.back-arrow { color: #b7c1ba; font-size: 30px; line-height: 1; }
.top-title { color: #202c29; font-size: 20px; font-weight: 800; }
.chat-row { display: flex; align-items: flex-start; gap: 12rpx; }
.assistant-row { justify-content: flex-start; }
.user-row { justify-content: flex-end; margin-top: 24rpx; }
.chat-avatar { width: 116rpx; height: 116rpx; overflow: hidden; flex-shrink: 0; }
.chat-avatar.small { width: 84rpx; height: 84rpx; }
.chat-avatar-image { width: 100%; height: 100%; transform: scale(1.72); }
.assistant-bubble { position: relative; max-width: 520rpx; padding: 20rpx 22rpx; border: 1rpx solid #dfe8e3; border-radius: 7px 18px 18px 18px; background: #fff; box-shadow: 0 7rpx 18rpx rgba(30, 50, 34, .055); }
.assistant-bubble::before { content: ''; position: absolute; left: -10rpx; top: 22rpx; width: 18rpx; height: 18rpx; border-left: 1rpx solid #dfe8e3; border-bottom: 1rpx solid #dfe8e3; background: #fff; transform: rotate(45deg); }
.welcome-bubble { margin-top: 8rpx; }
.welcome-title { display: block; color: #26352d; font-size: 15px; font-weight: 800; }
.welcome-text { display: block; margin-top: 8rpx; color: #738177; font-size: 10px; line-height: 1.6; }
.examples { margin-top: 24rpx; }
.section-title { display: block; margin: 0 4rpx 12rpx; color: #354039; font-size: 14px; font-weight: 800; }
.example-list { display: flex; flex-wrap: wrap; gap: 9rpx; }
.example-chip { padding: 10rpx 14rpx; border: 1rpx solid #d7e5dc; border-radius: 999rpx; color: #65746b; background: #f8fcf9; font-size: 10px; }
.conversation { margin-top: 6rpx; }
.user-bubble { max-width: 500rpx; padding: 16rpx 20rpx; border-radius: 18px 7px 18px 18px; color: #385b91; background: #e8f0ff; font-size: 11px; line-height: 1.6; }
.result-row { margin-top: 14rpx; }
.result-bubble { flex: 1; max-width: 540rpx; }
.result-head { display: flex; align-items: center; margin-bottom: 10rpx; }
.assistant-reply { position: relative; z-index: 1; display: block; color: #33423a; font-size: 11px; line-height: 1.65; }
.intent-pill { flex-shrink: 0; padding: 6rpx 12rpx; border-radius: 999rpx; font-size: 9px; font-weight: 700; }
.intent-pill.green { color: #438d50; background: #eaf6ec; }
.intent-pill.orange { color: #b76e35; background: #fff1e4; }
.intent-pill.blue { color: #527db3; background: #edf4fc; }
.intent-pill.gray { color: #7c8680; background: #f0f2f1; }
.field-label { display: block; color: #929c95; font-size: 9px; font-weight: 700; }
.command-section { margin-top: 16rpx; }
.item-list { margin-top: 8rpx; border: 1rpx solid #edf2ee; border-radius: 12px; overflow: hidden; }
.item-row { display: flex; align-items: center; justify-content: space-between; gap: 14rpx; padding: 13rpx 14rpx; border-bottom: 1rpx solid #edf2ee; }
.item-row:last-child { border-bottom: 0; }
.item-name { color: #354039; font-size: 11px; font-weight: 700; }
.item-meta { color: #7e8981; font-size: 9px; text-align: right; }
.summary-text { display: block; margin-top: 8rpx; color: #59665e; font-size: 10px; line-height: 1.6; }
.safety-note { display: flex; align-items: center; gap: 8rpx; margin-top: 14rpx; padding-top: 12rpx; border-top: 1rpx solid #edf2ee; color: #95a098; font-size: 9px; }
.safety-dot { width: 10rpx; height: 10rpx; border-radius: 50%; background: #75bf7e; flex-shrink: 0; }
.voice-entry { position: fixed; left: 50%; bottom: 122px; z-index: 20; display: flex; flex-direction: column; align-items: center; gap: 9rpx; transform: translateX(-50%); }
.voice-btn { width: 112rpx; height: 112rpx; display: flex; align-items: center; justify-content: center; border: 1rpx solid #d8e5fb; border-radius: 50%; background: #e8f0ff; color: #4a73d9; box-shadow: 0 10rpx 24rpx rgba(74, 115, 217, .16); }
.assistant-iconfont { font-family: "iconfont" !important; font-style: normal; font-weight: 400; line-height: 1; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
.voice-ico { color: inherit; font-size: 34px; }
.voice-entry-text { color: #53645b; font-size: 10px; font-weight: 700; white-space: nowrap; }
.voice-entry.recording .voice-btn { color: #fff; background: #4a73d9; animation: pulse 1.15s ease-in-out infinite; }
@keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
</style>
