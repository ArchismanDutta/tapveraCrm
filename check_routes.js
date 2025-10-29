const fs = require('fs');
const path = require('path');

const routesDir = './server/routes';
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const lines = content.split('\n');
  
  lines.forEach((line, idx) => {
    if (line.includes('router.') && (line.includes('get(') || line.includes('post(') || line.includes('put(') || line.includes('delete(') || line.includes('patch('))) {
      const pathMatch = line.match(/["']([^"']*)/);
      if (pathMatch) {
        const routePath = pathMatch[1];
        if (routePath.includes(':/') || routePath.includes('::') || routePath.endsWith(':') || /:\s*[,\)\/]/.test(routePath)) {
          console.log(`ISSUE in ${file} line ${idx+1}:`);
          console.log(`  ${line.trim()}`);
          console.log(`  Route path: "${routePath}"`);
          console.log('');
        }
      }
    }
  });
});
