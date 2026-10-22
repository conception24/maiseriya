import fs from 'node:fs';
const js=fs.readFileSync('work/standalone-build/saize-builder.js','utf8').replace(/<\/script/gi,'<\\/script');
const css=fs.readFileSync('work/standalone-build/sites-project.css','utf8');
fs.mkdirSync('standalone',{recursive:true});
fs.writeFileSync('standalone/サイゼをつくろう.html',`<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>サイゼをつくろう — 2D配置・3Dウォーク</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`);
console.log('Created standalone/サイゼをつくろう.html');
