const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3001;
const MIME = { '.html':'text/html', '.css':'text/css', '.js':'application/javascript' };

http.createServer((req, res) => {
  const file = req.url === '/' ? '/index.html' : req.url;
  const filePath = path.join(__dirname, file);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`\n📱 Mobile App running at: http://localhost:${PORT}\n`);
});
