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

  // Replace cyan tailwind classes with mint
  content = content.replace(/-cyan/g, '-mint');
  content = content.replace(/text-cyan/g, 'text-mint');
  content = content.replace(/bg-cyan/g, 'bg-mint');
  content = content.replace(/border-cyan/g, 'border-mint');
  content = content.replace(/ring-cyan/g, 'ring-mint');
  
  // Specific fix for globals.css accent colors
  if (file.endsWith('globals.css')) {
    // Light mode accent (emerald-500)
    content = content.replace(/--accent:\s*#0ea5e9;/, '--accent:   #10b981;');
    // Dark mode accent (emerald-400)
    content = content.replace(/--accent:\s*#38bdf8;/, '--accent:   #34d399;');
    // Focus ring
    content = content.replace(/rgba\(56,189,248/g, 'rgba(16,185,129');
    // Nav active
    content = content.replace(/rgba\(56,189,248/g, 'rgba(16,185,129');
    content = content.replace(/#38bdf8/g, '#34d399');
  }

  // Specific fix for tailwind.config.js box shadow
  if (file.endsWith('tailwind.config.js')) {
    content = content.replace(/rgba\(56,189,248,0.18\)/g, 'rgba(52,211,153,0.18)');
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
  }
});

console.log('Switched accent color to greenish (mint).');
