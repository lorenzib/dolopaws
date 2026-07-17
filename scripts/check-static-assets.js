const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function walk(directory){
  return fs.readdirSync(directory, { withFileTypes:true }).flatMap(entry => {
    if(entry.name === 'node_modules' || entry.name === '.git') return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const htmlFiles = walk(root).filter(file => file.endsWith('.html'));
const missing = [];

for(const file of htmlFiles){
  const html = fs.readFileSync(file, 'utf8');
  for(const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/g)){
    const raw = match[1];
    if(/^(?:https?:|mailto:|tel:|data:|#|javascript:|\/)/i.test(raw) || /[{}]/.test(raw)) continue;
    const clean = raw.split(/[?#]/)[0];
    if(!clean) continue;
    const target = path.resolve(path.dirname(file), clean);
    if(!fs.existsSync(target)) missing.push(`${path.relative(root, file)} -> ${raw}`);
  }
}

if(missing.length){
  console.error(`Missing local assets or pages (${missing.length}):\n${Array.from(new Set(missing)).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Static link check passed across ${htmlFiles.length} HTML files.`);
}
