const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  // Vue 3 no longer requires the DefinePlugin configuration
  // that was causing errors
})
