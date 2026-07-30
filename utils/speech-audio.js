import { getActiveBaseUrl } from '@/api/request'

export function configureSpeechAudio() {
	if (typeof uni.setInnerAudioOption !== 'function') return
	try {
		uni.setInnerAudioOption({
			mixWithOther: false,
			obeyMuteSwitch: false
		})
	} catch (error) {
		console.warn('语音播放设置初始化失败', error)
	}
}

export function playSpeechAudio(audioContext, audioPath) {
	return new Promise((resolve, reject) => {
		if (!audioContext || typeof uni.downloadFile !== 'function') {
			reject(new Error('当前环境不支持语音播放'))
			return
		}
		const path = `${audioPath || ''}`.trim()
		if (!path) {
			reject(new Error('朗读音频地址为空'))
			return
		}
		const url = /^https?:\/\//i.test(path) ? path : `${getActiveBaseUrl()}${path}`
		uni.downloadFile({
			url,
			timeout: 30000,
			success: (res) => {
				const statusCode = Number(res?.statusCode || 0)
				const tempFilePath = `${res?.tempFilePath || ''}`.trim()
				if (statusCode < 200 || statusCode >= 300 || !tempFilePath) {
					reject(new Error(`朗读音频下载失败${statusCode ? `（${statusCode}）` : ''}`))
					return
				}
				audioContext.stop()
				audioContext.volume = 1
				audioContext.obeyMuteSwitch = false
				audioContext.autoplay = true
				audioContext.src = tempFilePath
				setTimeout(() => {
					try {
						audioContext.play()
						resolve(tempFilePath)
					} catch (error) {
						reject(error)
					}
				}, 180)
			},
			fail: (error) => {
				console.error('朗读音频下载失败', error)
				reject(new Error(error?.errMsg || '朗读音频下载失败'))
			}
		})
	})
}
