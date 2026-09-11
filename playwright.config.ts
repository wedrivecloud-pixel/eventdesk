import { defineConfig } from '@playwright/test';
export default defineConfig({
 testDir:'./tests/browser',timeout:180000,workers:1,reporter:[['list'],['json',{outputFile:'artifacts/browser-results.json'}]],
 use:{baseURL:process.env.QA_BASE_URL||'http://localhost:3100',headless:true,...(process.platform==='win32'?{channel:'chrome'}:{}),screenshot:'only-on-failure',trace:'retain-on-failure'},
});
