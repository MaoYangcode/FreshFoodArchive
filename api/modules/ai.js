import { BASE_URL, request } from '../request'

export function recognizeIngredients(payload) {
	return request({
		url: '/ai/recognize-ingredient',
		method: 'POST',
		data: payload
	})
}

export function recognizeIngredientsByUpload(filePath) {
	return uploadAiImage('/ai/recognize-ingredient', filePath)
}

export function recognizeReceiptByUpload(filePath) {
	return uploadAiImage('/ai/recognize-receipt', filePath)
}

function uploadAiImage(apiPath, filePath) {
	return new Promise((resolve, reject) => {
		uni.uploadFile({
			url: `${BASE_URL}${apiPath}`,
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
