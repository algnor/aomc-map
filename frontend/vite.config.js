import { defineConfig } from 'vite'

export default defineConfig({
    server: {
        port: 8001,
        host: "0.0.0.0",
        proxy: {
            '/api': 'http://backend:8000',
            '/map': 'http://backend:8000',
            '/static': 'http://backend:8000',
        },
        allowedHosts: ["frontend"]
    }
})