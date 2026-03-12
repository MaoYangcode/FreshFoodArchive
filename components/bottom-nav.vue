<template>
	<view class="tabbar">
		<view class="tab" :class="{ active: current === 'home' }" @click="go('/pages/home/index')">
			<text class="icon">🏠</text>
			<text>首页</text>
		</view>
		<view class="tab" :class="{ active: current === 'fridge' }" @click="go('/pages/fridge/list')">
			<text class="icon">🧊</text>
			<text>冰箱</text>
		</view>
		<view class="tab" :class="{ active: current === 'add' }" @click="go('/pages/fridge/add')">
			<text class="icon">➕</text>
			<text>添加</text>
		</view>
		<view class="tab" :class="{ active: current === 'recipe' }" @click="go('/pages/recipe/generate')">
			<text class="icon">📖</text>
			<text>菜谱</text>
		</view>
		<view class="tab" :class="{ active: current === 'profile' }" @click="go('/pages/profile/index')">
			<text class="icon">👤</text>
			<text>我的</text>
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
.tabbar {
	position: fixed;
	left: 0;
	right: 0;
	bottom: 0;
	height: 66px;
	padding: 2px 6px 8px;
	border-top: 1px solid #e7eceb;
	background: rgba(255, 255, 255, 0.96);
	display: grid;
	grid-template-columns: repeat(5, 1fr);
	align-items: center;
	z-index: 999;
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
	font-size: 17px;
	margin-bottom: 2px;
}

.tab.active {
	color: #47ad53;
	font-weight: 700;
}
</style>
