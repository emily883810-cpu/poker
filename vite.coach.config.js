import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',define:{'import.meta.env.VITE_COACH_ONLY':JSON.stringify('true')},build:{outDir:'coach-dist',emptyOutDir:true}});
