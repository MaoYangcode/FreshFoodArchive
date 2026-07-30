import { getActiveBaseUrl, request } from '../request'
import { getAuthToken } from '../../utils/current-user'

export function recognizeIngredients(payload) {
	return request({
		url: '/ai/recognize-ingredient',
		method: 'POST',
		data: payload
	})
}

export function recognizeIngredientsByUpload(filePath) {
	return uploadAiFile('/ai/recognize-ingredient', filePath)
}

export function recognizeReceiptByUpload(filePath) {
	return uploadAiFile('/ai/recognize-receipt', filePath)
}

export function recognizeAudioByUpload(filePath) {
	return uploadAiFile('/ai/recognize-audio', filePath)
}

export function parseAssistantCommand(text) {
	return request({
		url: '/ai/parse-assistant-command',
		method: 'POST',
		data: { text },
		timeout: 30000
	})
}

export function synthesizeAssistantSpeech(text) {
	return request({
		url: '/ai/synthesize-speech',
		method: 'POST',
		data: { text },
		timeout: 30000
	})
}

function uploadAiFile(apiPath, filePath) {
	return new Promise((resolve, reject) => {
		const token = `${getAuthToken() || ''}`.trim()
		if (!token) {
			reject({
				code: 401,
				message: '请先完成微信登录'
			})
			return
		}
		uni.uploadFile({
			url: `${getActiveBaseUrl()}${apiPath}`,
			filePath,
			name: 'file',
			timeout: 120000,
			header: {
				Authorization: `Bearer ${token}`
			},
			success: (res) => {
				try {
					const statusCode = Number(res?.statusCode || 0)
					const payload = JSON.parse(res?.data || '{}')
					if (statusCode < 200 || statusCode >= 300) {
						reject(payload)
						return
					}
					if (payload.code === 0 || payload.code === undefined) {
						resolve(payload)
						return
					}
					reject(payload)
				} catch (e) {
					reject(e)
				}
			},
			fail: (err) => reject(err)
		})
	})
}
