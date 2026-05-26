const fs = require('fs');
const path = require('path');

const clientDir = path.join(__dirname, '../client');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') walk(fullPath, callback);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.css') || fullPath.endsWith('.js')) {
      callback(fullPath);
    }
  }
}

walk(clientDir, (file) => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // Replace dark blue hexes with dark green hexes
  content = content.replace(/#0b0f14/g, '#05130d');
  content = content.replace(/#121821/g, '#0a1c14');
  content = content.replace(/#0f141b/g, '#0e251a');
  content = content.replace(/#253142/g, '#193f2c');
  
  // Specific to login page gradient
  content = content.replace(/#0f1c2e/g, '#0a2318');
  content = content.replace(/#0a1628/g, '#061811');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log('Switched background tones from bluish to greenish.');
