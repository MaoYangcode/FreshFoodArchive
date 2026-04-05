<template>
	<view class="tabbar">
		<view class="tab" :class="{ active: current === 'home' }" @click="go('/pages/home/index')">
			<text class="icon iconfont-tab">&#xe612;</text>
			<text class="tab-text">首页</text>
		</view>
		<view class="tab" :class="{ active: current === 'fridge' }" @click="go('/pages/fridge/list')">
			<text class="icon iconfont-tab">&#xe90b;</text>
			<text class="tab-text">食材</text>
		</view>
		<view class="tab tab-add" :class="{ active: current === 'add' }" @click="go('/pages/fridge/add')">
			<view class="add-fab">
				<view class="add-plus">
					<text class="plus-bar plus-v"></text>
					<text class="plus-bar plus-h"></text>
				</view>
			</view>
		</view>
		<view class="tab" :class="{ active: current === 'recipe' }" @click="go('/pages/recipe/generate')">
			<text class="icon iconfont-tab icon-recipe">&#xe623;</text>
			<text class="tab-text">菜谱</text>
		</view>
		<view class="tab" :class="{ active: current === 'profile' }" @click="go('/pages/profile/index')">
			<text class="icon iconfont-tab">&#xe615;</text>
			<text class="tab-text">我的</text>
		</view>
	</view>
</template>

<script>
export default {
	props: {
		current: {
			type: String,
			default: 'home'
		}
	},
	methods: {
		go(url) {
			const currentRoute = `/${getCurrentPages().slice(-1)[0].route}`
			if (currentRoute === url) return
			uni.reLaunch({ url })
		}
	}
}
</script>

<style scoped>
@font-face {
	font-family: "bottom-iconfont";
	src: url('/static/iconfont/iconfont.ttf') format('truetype');
}

.tabbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 58px;
	padding: 4px 6px 5px;
	border-top: 1px solid #e7eceb;
	background: rgba(255, 255, 255, 0.96);
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	align-items: center;
	z-index: 999;
	overflow: visible;
}

.tab {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	color: #819085;
	line-height: 1;
}

.icon {
	font-size: 22px;
	margin-bottom: 2px;
}

.tab-text {
	margin-top: 4px;
}

.iconfont-tab {
	font-family: "bottom-iconfont" !important;
	font-style: normal;
	font-weight: 400;
	line-height: 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

.icon-recipe {
	font-size: 26px;
}

.tab.active {
	color: #47ad53;
	font-weight: 700;
}

.tab-add {
	position: static;
	padding-top: 6px;
}

.add-fab {
	position: absolute;
	top: -20px;
	left: 50%;
	transform: translateX(-50%);
	width: 48px;
	height: 48px;
	border-radius: 50%;
	background: linear-gradient(135deg, #70c977, #4cae57);
	border: 5px solid #fff;
	box-shadow: 0 7px 12px rgba(76, 174, 87, 0.22);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 3;
}

.add-plus {
	position: relative;
	width: 20px;
	height: 20px;
	transform: none;
}

.plus-bar {
	position: absolute;
	left: 50%;
	top: 50%;
	background: #fff;
	border-radius: 999px;
	transform: translate(-50%, -50%);
}

.plus-v {
	width: 3px;
	height: 17px;
}

.plus-h {
	width: 17px;
	height: 3px;
}

</style>
