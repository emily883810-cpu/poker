import {defineConfig} from '@playwright/test';
import {randomBytes} from 'node:crypto';
process.env.POKER_WEB_TEST_PASSWORD ||= randomBytes(24).toString('hex');
export default defineConfig({testDir:'tests/web-e2e',workers:1,use:{baseURL:'http://127.0.0.1:8020',viewport:{width:390,height:844},isMobile:true,hasTouch:true,launchOptions:process.env.POKER_CHROMIUM?{executablePath:process.env.POKER_CHROMIUM}:{}},webServer:{command:'.venv/bin/python -m server.app',url:'http://127.0.0.1:8020/api/health',env:{POKER_PUBLIC:'1',POKER_PORT:'8020',POKER_DB:'/tmp/poker-os-web-e2e.sqlite3',POKER_PASSWORD:process.env.POKER_WEB_TEST_PASSWORD},reuseExistingServer:false},reporter:'list',outputDir:'/tmp/poker-os-web-test-results'});
