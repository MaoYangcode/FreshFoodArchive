import { request } from '../request'

export function loginWithWeChatCode(code) {
	return request({
		url: '/auth/wechat-login',
		method: 'POST',
		data: {
			code: `${code || ''}`.trim()
		},
		timeout: 15000
	})
}
