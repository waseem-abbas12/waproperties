const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Static files in public
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    return res.end(fs.readFileSync(path.join(__dirname, 'public', 'index.html')));
  }

  if (pathname === '/waproperties_workflow.json') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(fs.readFileSync(path.join(__dirname, 'waproperties_workflow.json')));
  }

  // API endpoints
  if (pathname === '/api/properties') {
    return require('./api/properties.js')(req, res);
  }

  if (pathname === '/api/leads') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (body) {
        try { req.body = JSON.parse(body); } catch (e) {}
      }
      return require('./api/leads.js')(req, res);
    });
    return;
  }

  if (pathname === '/api/chat') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      if (body) {
        try { req.body = JSON.parse(body); } catch (e) {}
      }
      return require('./api/chat.js')(req, res);
    });
    return;
  }

  if (pathname === '/api/webhook') {
    return require('./api/webhook.js')(req, res);
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`waproperties server running at http://localhost:${PORT}`);
});
