const { defineConfig } = require('@vue/cli-service')

module.exports = defineConfig({
  transpileDependencies: true,
  publicPath: '/',
  // Output to dist folder (default, but explicitly stating)
  outputDir: 'dist',
  // Ensure index.html is generated
  indexPath: 'index.html'
})
