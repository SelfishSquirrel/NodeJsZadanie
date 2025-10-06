const http = require('http');
const fs = require('fs').promises;
const url = require('url');

let visitCount = 0; 

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    if (pathname === '/') {
      visitCount++;
      res.writeHead(200);
      res.end(`
        <h1>Witaj na stronie!</h1>
        <p>Odwiedziłeś ją już ${visitCount} razy.</p>
      `);

    } else {
      res.writeHead(404);
      res.end('<h1>404 - Strona nie istnieje</h1>');
    }
  } catch (err) {
    res.writeHead(500);
    res.end('<h1>Błąd serwera</h1><p>Wystąpił nieoczekiwany błąd</p>');
    console.error(err);
  }
});

server.listen(3000, () => {
  console.log('Serwer działa na porcie 3000');
});