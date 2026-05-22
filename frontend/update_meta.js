const fs = require('fs');
const path = require('path');
const dir = '.';

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.html')) {
    let content = fs.readFileSync(path.join(dir, file), 'utf8');
    
    let modified = false;
    
    // Replace old viewport
    if (content.includes('<meta name="viewport" content="width=device-width, initial-scale=1.0">')) {
      content = content.replace(
        /<meta name="viewport" content="width=device-width, initial-scale=1.0">/g,
        '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
      );
      modified = true;
    }
    
    // Add theme-color if not present
    if (!content.includes('<meta name="theme-color"')) {
      content = content.replace(
        /<meta name="viewport"[^>]+>/,
        match => match + '\n  <meta name="theme-color" content="#07060e">'
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(path.join(dir, file), content, 'utf8');
      console.log('Updated ' + file);
    }
  }
});
