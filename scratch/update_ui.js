const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../client/src');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walk(fullPath, callback);
    } else if (fullPath.endsWith('.jsx')) {
      callback(fullPath);
    }
  }
}

walk(srcDir, (file) => {
  // Skip the layout/sidebar/topbar/bottomnav since we just wrote them explicitly
  if (file.includes('AppShell.jsx') || file.includes('Sidebar.jsx') || file.includes('TopBar.jsx') || file.includes('BottomNav.jsx') || file.includes('login') || file.includes('admin\\page.jsx')) {
    return;
  }

  let content = fs.readFileSync(file, 'utf8');

  // Colors
  content = content.replace(/bg-panel/g, 'bg-[var(--surface)]');
  // Only replace bg-ink if it's a class
  content = content.replace(/bg-ink/g, 'bg-[var(--surface2)]');
  content = content.replace(/border-line/g, 'border-[var(--border)]');
  
  // Text colors
  content = content.replace(/text-white/g, 'text-[var(--text)]');
  content = content.replace(/text-slate-200/g, 'text-[var(--text)]');
  content = content.replace(/text-slate-300/g, 'text-[var(--text)]');
  content = content.replace(/text-slate-400/g, 'text-[var(--muted)]');
  content = content.replace(/text-slate-500/g, 'text-[var(--muted)]');
  content = content.replace(/text-slate-600/g, 'text-[var(--muted)]');
  
  // Specific ink usage in text (like text-ink for buttons)
  content = content.replace(/text-ink/g, 'text-[#0b0f14]');

  // Rounding updates for a more modern card feel
  content = content.replace(/rounded-lg/g, 'rounded-2xl');
  content = content.replace(/rounded-md/g, 'rounded-xl');

  fs.writeFileSync(file, content, 'utf8');
});

console.log('UI replacement complete.');
