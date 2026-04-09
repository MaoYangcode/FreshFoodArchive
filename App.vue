<script>
	import { setCurrentUserId } from '@/utils/current-user'

	export default {
		onLaunch: function() {
			// Keep a stable debug user before real auth integration.
			setCurrentUserId(1)
			console.log('FreshFoodArchive Launch')
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
