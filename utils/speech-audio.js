import { getActiveBaseUrl } from '@/api/request'

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
				audioContext.src = tempFilePath
				audioContext.play()
				resolve(tempFilePath)
			},
			fail: (error) => {
				console.error('朗读音频下载失败', error)
				reject(new Error(error?.errMsg || '朗读音频下载失败'))
			}
		})
	})
}
