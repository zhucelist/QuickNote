const fs = require('fs');
const path = require('path');

const dir = path.resolve(__dirname, 'node_modules/react-screenshots/lib');

function walk(directory) {
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const filePath = path.join(directory, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath);
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      const newContent = content.replace(/import\s+['"].*\.css['"];/g, '// $&');
      if (content !== newContent) {
        console.log('Fixed:', filePath);
        fs.writeFileSync(filePath, newContent);
      }
    }
  }
}

if (fs.existsSync(dir)) {
  walk(dir);
  console.log('Finished patching react-screenshots');
} else {
  console.error('react-screenshots lib not found');
}
