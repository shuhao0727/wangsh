const fs = require('fs');
const path = require('path');
const htmlPath = path.join(__dirname, '..', '..', 'public', 'mindmap-demo', 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
const bridge = '<script>window.addEventListener("message",function(e){if(e.data&&e.data.type==="mindmap:getData"){var d=window.takeOverAppMethods&&window.takeOverAppMethods.getMindMapData?window.takeOverAppMethods.getMindMapData():null;if(d){e.source.postMessage({type:"mindmap:save",data:d.root||d},"*")}}});</script>';
if (!html.includes('mindmap:save')) {
  html = html.replace('</body>', bridge + '</body>');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('postMessage bridge injected');
}
