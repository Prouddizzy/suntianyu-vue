const { defineConfig } = require('@vue/cli-service');

// Proxy API calls during local dev to the Java backend on http://localhost:8090
// so the frontend can call /api/v1/* without CORS issues.
module.exports = defineConfig({
  transpileDependencies: true,
  devServer: {
    proxy: {
      '/api': {
        target: 'http://110.42.101.248:51001',
        changeOrigin: true,
      },
    },
  },
});
