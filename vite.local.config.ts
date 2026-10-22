import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 publicDir:false, define:{'process.env.NODE_ENV':'"production"'},
 plugins:[react()],
 resolve:{alias:{'@':fileURLToPath(new URL('.',import.meta.url))}},
 css:{postcss:{plugins:[tailwindcss()]}},
 build:{outDir:'../../work/standalone-build',emptyOutDir:true,lib:{entry:'app/local-entry.tsx',name:'SaizeBuilder',formats:['iife'],fileName:()=> 'saize-builder.js'},rolldownOptions:{output:{codeSplitting:false}},cssCodeSplit:false}
});

