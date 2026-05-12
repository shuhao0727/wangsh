const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '..', '..', 'public', 'mindmap-demo', 'index.html');
if (fs.existsSync(htmlPath)) {
  console.log('mindmap-demo built OK');
}
