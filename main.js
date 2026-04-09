import App from './App'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false

function readInitialSafeTop() {
  try {
    const info = uni.getSystemInfoSync()
    const top = Number(info?.statusBarHeight || 0)
    if (Number.isFinite(top) && top > 0) return top
  } catch (e) {}
  return 20
}

function readInitialNavRightGap() {
  try {
    const info = uni.getSystemInfoSync()
    if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
      const menu = uni.getMenuButtonBoundingClientRect()
      const windowWidth = Number(info?.windowWidth || 0)
      const rightGap = windowWidth > 0 && menu
        ? Math.round(windowWidth - Number(menu.left || 0) + 8)
        : 12
      if (Number.isFinite(rightGap) && rightGap > 0) return rightGap
    }
  } catch (e) {}
  return 12
}

const safeTopMixin = {
  data() {
    return {
      safeTop: readInitialSafeTop(),
      navRightGap: readInitialNavRightGap(),
    }
  },
  onLoad() {
    try {
      const info = uni.getSystemInfoSync()
      const top = Number(info?.statusBarHeight || 0)
      if (Number.isFinite(top) && top > 0) this.safeTop = top
      if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
        const menu = uni.getMenuButtonBoundingClientRect()
        const windowWidth = Number(info?.windowWidth || 0)
        const rightGap = windowWidth > 0 && menu
          ? Math.round(windowWidth - Number(menu.left || 0) + 8)
          : 12
        if (Number.isFinite(rightGap) && rightGap > 0) this.navRightGap = rightGap
      }
    } catch (e) {}
  },
}
Vue.mixin(safeTopMixin)
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
export function createApp() {
  const readInitialSafeTop = () => {
    try {
      const info = uni.getSystemInfoSync()
      const top = Number(info?.statusBarHeight || 0)
      if (Number.isFinite(top) && top > 0) return top
    } catch (e) {}
    return 20
  }
  const readInitialNavRightGap = () => {
    try {
      const info = uni.getSystemInfoSync()
      if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
        const menu = uni.getMenuButtonBoundingClientRect()
        const windowWidth = Number(info?.windowWidth || 0)
        const rightGap = windowWidth > 0 && menu
          ? Math.round(windowWidth - Number(menu.left || 0) + 8)
          : 12
        if (Number.isFinite(rightGap) && rightGap > 0) return rightGap
      }
    } catch (e) {}
    return 12
  }
  const app = createSSRApp(App)
  app.mixin({
    data() {
      return {
        safeTop: readInitialSafeTop(),
        navRightGap: readInitialNavRightGap(),
      }
    },
    onLoad() {
      try {
        const info = uni.getSystemInfoSync()
        const top = Number(info?.statusBarHeight || 0)
        if (Number.isFinite(top) && top > 0) this.safeTop = top
        if (typeof uni.getMenuButtonBoundingClientRect === 'function') {
          const menu = uni.getMenuButtonBoundingClientRect()
          const windowWidth = Number(info?.windowWidth || 0)
          const rightGap = windowWidth > 0 && menu
            ? Math.round(windowWidth - Number(menu.left || 0) + 8)
            : 12
          if (Number.isFinite(rightGap) && rightGap > 0) this.navRightGap = rightGap
        }
      } catch (e) {}
    },
  })
  return {
    app
  }
}
// #endif