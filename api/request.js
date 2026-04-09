import { getCurrentUserId } from '../utils/current-user'

// NOTE: Real-device debug often changes LAN IP.
// Keep multiple local candidates and auto-fallback to first reachable one.
const BASE_URL_CANDIDATES = [
	'http://192.168.10.215:3000',
	'http://172.20.10.10:3000'
]

let activeBaseUrl = BASE_URL_CANDIDATES[0]

export const BASE_URL = activeBaseUrl
export function getActiveBaseUrl() {
	return activeBaseUrl
}

function requestOnce(baseUrl, { url, method = 'GET', data = {}, header = {} }) {
	return new Promise((resolve, reject) => {
		const userId = getCurrentUserId()
		const headers = {
			'x-user-id': String(userId),
			...header
		}
		uni.request({
			url: `${baseUrl}${url}`,
			method,
			data,
			header: headers,
			timeout: 8000,
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

export function request({ url, method = 'GET', data = {}, header = {} }) {
	const orderedBases = [activeBaseUrl, ...BASE_URL_CANDIDATES.filter((x) => x !== activeBaseUrl)]
	const tryNext = (index, lastError) => {
		if (index >= orderedBases.length) {
			return Promise.reject(lastError || new Error('all base urls failed'))
		}
		const base = orderedBases[index]
		return requestOnce(base, { url, method, data, header })
			.then((payload) => {
				activeBaseUrl = base
				return payload
			})
			.catch((err) => {
				// Business error from backend should not trigger base URL fallback.
				const hasBizCode = err && typeof err === 'object' && Object.prototype.hasOwnProperty.call(err, 'code')
				if (hasBizCode) return Promise.reject(err)
				return tryNext(index + 1, err)
			})
	}
	return tryNext(0, null)
}
