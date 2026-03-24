import { BASE_URL, request } from '../request'

export function recognizeIngredients(payload) {
	return request({
		url: '/ai/recognize-ingredient',
		method: 'POST',
		data: payload
	})
}

export function recognizeIngredientsByUpload(filePath) {
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url: `${BASE_URL}/ai/recognize-ingredient`,
			filePath,
			name: 'file',
			success: (res) => {
				try {
					const payload = JSON.parse(res?.data || '{}')
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
