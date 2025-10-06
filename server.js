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

    } else if (pathname === '/add') {
 
      const name = parsedUrl.query.name;
      if (!name) {
        res.writeHead(400);
        res.end('<h1>Błąd</h1><p>Parametr "name" jest wymagany!</p>');
        return;
      }

      await fs.appendFile('guests.txt', `${name}\n`);
      res.writeHead(200);
      res.end(`<h1>Sukces</h1><p>Dodano imię: ${name}</p>`);

    } else if (pathname === '/list') {

      try {
        const data = await fs.readFile('guests.txt', 'utf-8');
        const names = data.split('\n').filter(name => name.trim() !== '');
        
        if (names.length === 0) {
          res.writeHead(200);
          res.end('<h1>Lista gości</h1><p>Lista gości jest pusta</p>');
        } else {
          const listItems = names.map(name => `<li>${name}</li>`).join('');
          res.writeHead(200);
          res.end(`
            <h1>Lista gości</h1>
            <ul>${listItems}</ul>
          `);
        }
      } catch (err) {
        if (err.code === 'ENOENT') {

          res.writeHead(200);
          res.end('<h1>Lista gości</h1><p>Lista gości jest pusta</p>');
        } else {
          throw err;
        }
      }

    } else if (pathname === '/clear') {

      await fs.writeFile('guests.txt', '');
      res.writeHead(200);
      res.end('<h1>Sukces</h1><p>Zawartość pliku guests.txt została usunięta</p>');

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