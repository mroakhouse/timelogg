import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'tests/ui',use:{baseURL:'http://127.0.0.1:5173',channel:process.platform==='win32'?'msedge':undefined,headless:true},webServer:{command:'npm run dev',url:'http://127.0.0.1:5173',reuseExistingServer:true},workers:1});
