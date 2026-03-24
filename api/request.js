export const BASE_URL = 'http://127.0.0.1:3000'

export function request({ url, method = 'GET', data = {}, header = {} }) {
	return new Promise((resolve, reject) => {
		uni.request({
			url: `${BASE_URL}${url}`,
			method,
			data,
			header,
			success: (res) => {
				const payload = res.data || {}
				if (payload.code === 0 || payload.code === undefined) {
					resolve(payload)
					return
				}
				reject(payload)
			},
			fail: (err) => {
				reject(err)
			}
		})
	})
}
