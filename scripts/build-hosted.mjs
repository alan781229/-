import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const root=process.cwd();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const assets={};
async function walk(directory){for(const entry of await fs.readdir(directory,{withFileTypes:true})){const absolute=path.join(directory,entry.name);if(entry.isDirectory())await walk(absolute);else{const key='/'+path.relative(path.join(root,'out'),absolute).split(path.sep).join('/');assets[key]={mime:mime[path.extname(absolute)]||'application/octet-stream',data:(await fs.readFile(absolute)).toString('base64')};}}}
await walk(path.join(root,'out'));
const scanner=ts.transpileModule(await fs.readFile(path.join(root,'src/lib/scanner.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^export /gm,'');
const worker=(await fs.readFile(path.join(root,'worker/index.mjs'),'utf8')).replace(/^import .*scanner.ts.*\n/,'');
await fs.mkdir(path.join(root,'dist/server'),{recursive:true});
await fs.writeFile(path.join(root,'dist/server/index.js'),`const ASSETS=${JSON.stringify(assets)};\n${scanner}\n${worker}`);
console.log(`Worker packaged ${Object.keys(assets).length} assets`);

await fs.mkdir(path.join(root,'dist/.openai'),{recursive:true});
await fs.copyFile(path.join(root,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));
