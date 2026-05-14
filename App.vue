<script>
	import { clearAuthToken, clearCurrentUserId, getAuthToken, getCurrentUserId, setAuthToken, setCurrentUserId } from '@/utils/current-user'
	import { loginWithWeChatCode } from '@/api/modules/auth'

	function toUserId(value) {
		const n = Number(value)
		if (!Number.isFinite(n) || n <= 0) return 0
		return Math.floor(n)
	}

	function getLoginErrorMessage(err) {
		const message =
			`${err?.message || ''}`.trim() ||
			`${err?.msg || ''}`.trim() ||
			`${err?.error || ''}`.trim() ||
			`${err?.data?.message || ''}`.trim()
		if (message) return `微信登录失败：${message}`
		const statusCode = Number(err?.statusCode || err?.data?.statusCode || 0)
		if (statusCode) return `微信登录失败：服务返回 ${statusCode}`
		return '微信登录失败，请检查网络后重试'
	}

	export default {
		onLaunch: function() {
			this.bootstrapUserId(0)
			console.log('FreshFoodArchive Launch')
		},
		methods: {
			bootstrapUserId(retryCount = 0) {
				const localToken = `${getAuthToken() || ''}`.trim()
				const localUserId = toUserId(getCurrentUserId())
				if (localToken && localUserId > 0) return
				if (typeof uni === 'undefined' || typeof uni.login !== 'function') {
					this.retryForceLogin('当前环境不支持微信登录，请在微信内打开小程序')
					return
				}
				uni.login({
					provider: 'weixin',
					success: ({ code }) => {
						const safeCode = `${code || ''}`.trim()
						if (!safeCode) {
							this.handleLoginFailure('未获取到微信登录凭证，请重试', retryCount)
							return
						}
						loginWithWeChatCode(safeCode)
							.then((res) => {
								const userId = toUserId(res?.userId)
								const token = `${res?.token || ''}`.trim()
								if (!userId || !token) {
									throw new Error('invalid login payload')
								}
								setCurrentUserId(userId)
								setAuthToken(token)
							})
							.catch((err) => {
								this.handleLoginFailure(getLoginErrorMessage(err), retryCount)
							})
					},
					fail: () => {
						this.handleLoginFailure('微信登录失败，请检查网络后重试', retryCount)
					}
				})
			},
			handleLoginFailure(message, retryCount = 0) {
				const nextRetry = Number(retryCount || 0) + 1
				if (nextRetry <= 2) {
					setTimeout(() => this.bootstrapUserId(nextRetry), 500 * nextRetry)
					return
				}
				this.retryForceLogin(message)
			},
			retryForceLogin(message) {
				clearCurrentUserId()
				clearAuthToken()
				uni.showModal({
					title: '需要微信登录',
					content: message || '登录失败，请重试',
					showCancel: false,
					confirmText: '重试',
					success: () => {
						setTimeout(() => this.bootstrapUserId(0), 250)
					}
				})
			}
		},
		onShow: function() {
			console.log('FreshFoodArchive Show')
		},
		onHide: function() {
			console.log('FreshFoodArchive Hide')
		}
	}
</script>

<style>
	@import "@/static/iconfont/iconfont.css";

	page {
		background: #f4f6f8;
		font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
		color: #202823;
		box-sizing: border-box;
	}

	view,
	text,
	button,
	input,
	textarea,
	label,
	navigator {
		font-family: "PingFang SC", "Microsoft YaHei", sans-serif;
	}
</style>
