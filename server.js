const http = require('http');
const fs = require('fs').promises;
const fsSync = require('fs');
const url = require('url');
const qs = require('querystring');

let visitCount = 0;
const ipVisits = {};
const guestsFile = 'guests.json';
const errorsLog = 'errors.log';
const accessLog = 'access.log';

process.on('uncaughtException', (err) => {
  const errorMsg = `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}\n\n`;
  console.error(errorMsg);
  
  fsSync.appendFile(errorsLog, errorMsg, (writeErr) => {
    if (writeErr) console.error('Nie można zapisać błędu do pliku:', writeErr);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  const errorMsg = `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason}\n${promise}\n\n`;
  console.error(errorMsg);
  
  fsSync.appendFile(errorsLog, errorMsg, (writeErr) => {
    if (writeErr) console.error('Nie można zapisać błędu do pliku:', writeErr);
  });
});

const cssStyle = `
  body { font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333; padding: 20px; }
  h1 { color: #007bff; }
  ul { list-style-type: none; padding: 0; }
  li { background: #fff; margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
  form { max-width: 400px; margin: 20px 0; }
  input[type="text"], input[type="submit"] { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; }
  input[type="submit"] { background-color: #007bff; color: white; border: none; cursor: pointer; }
  input[type="submit"]:hover { background-color: #0056b3; }
  .error { color: #dc3545; }
  .warning { color: #ffc107; }
`;

function logAccess(ip, path, statusCode) {
  const logMsg = `[${new Date().toISOString()}] IP: ${ip} | Path: ${path} | Status: ${statusCode}\n`;
  
  fsSync.appendFile(accessLog, logMsg, (err) => {
    if (err) console.error('Nie można zapisać do access.log:', err);
  });
}

async function readGuests() {
  try {
    const data = await fs.readFile(guestsFile, 'utf-8');
    
    try {
      const guests = JSON.parse(data);
      if (!Array.isArray(guests)) {
        throw new Error('Invalid JSON structure - not an array');
      }
      return guests;
    } catch (parseErr) {
      console.error('Błąd parsowania JSON, tworzę nowy plik:', parseErr.message);
      await writeGuests([]);
      return [];
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      await writeGuests([]);
      return [];
    }
    throw err;
  }
}

async function writeGuests(guests) {
  try {
    await fs.writeFile(guestsFile, JSON.stringify(guests, null, 2));
  } catch (err) {
    if (err.code === 'EACCES') {
      throw new Error('Brak uprawnień do zapisu pliku guests.json');
    }
    throw err;
  }
}

function validateName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Pole "name" jest wymagane' };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length === 0) {
    return { valid: false, error: 'Pole "name" nie może być puste' };
  }
  
  if (trimmedName.length > 50) {
    return { valid: false, error: 'Imię nie może być dłuższe niż 50 znaków' };
  }
  
  const validPattern = /^[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9\s\-]+$/;
  if (!validPattern.test(trimmedName)) {
    return { valid: false, error: 'Imię zawiera niedozwolone znaki specjalne' };
  }
  
  return { valid: true, value: trimmedName };
}

function get404Page() {
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <title>404 - Nie znaleziono</title>
      <style>
        ${cssStyle}
        .error-container { 
          text-align: center; 
          padding: 50px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 600px;
          margin: 50px auto;
        }
        h1 { font-size: 72px; margin: 0; color: #dc3545; }
        p { font-size: 18px; color: #666; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>404</h1>
        <h2>Strona nie istnieje</h2>
        <p>Przepraszamy, ale strona której szukasz nie została znaleziona.</p>
        <p><a href="/">Wróć do strony głównej</a></p>
      </div>
    </body>
    </html>
  `;
}

function get500Page(errorMsg = null) {
  return `
    <!DOCTYPE html>
    <html lang="pl">
    <head>
      <title>500 - Błąd serwera</title>
      <style>
        ${cssStyle}
        .error-container { 
          text-align: center; 
          padding: 50px;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          max-width: 600px;
          margin: 50px auto;
        }
        h1 { font-size: 72px; margin: 0; color: #dc3545; }
        p { font-size: 18px; color: #666; }
        .error-details { 
          background: #f8f9fa; 
          padding: 15px; 
          border-radius: 5px; 
          margin-top: 20px;
          font-family: monospace;
          font-size: 14px;
          color: #dc3545;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>500</h1>
        <h2>Błąd serwera</h2>
        <p>Przepraszamy, wystąpił błąd po stronie serwera.</p>
        <p>Spróbuj ponownie za chwilę lub skontaktuj się z administratorem.</p>
        ${errorMsg ? `<div class="error-details">${errorMsg}</div>` : ''}
      </div>
    </body>
    </html>
  `;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const ip = req.connection.remoteAddress;

  visitCount++;
  if (!ipVisits[ip]) ipVisits[ip] = 0;
  ipVisits[ip]++;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    if (pathname === '/' && method === 'GET') {
      logAccess(ip, pathname, 200);
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Strona Główna</title><style>${cssStyle}</style></head>
        <body>
          <h1>Witaj na stronie!</h1>
          <p>Odwiedziłeś ją już ${visitCount} razy.</p>
          <p><a href="/form">Dodaj gościa</a> | <a href="/list">Lista gości</a> | <a href="/stats">Statystyki</a></p>
        </body>
        </html>
      `);

    } else if (pathname === '/stats' && method === 'GET') {
      logAccess(ip, pathname, 200);
      let ipList = '';
      for (const [key, value] of Object.entries(ipVisits)) {
        ipList += `<li>IP: ${key} - Odwiedzin: ${value}</li>`;
      }
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Statystyki</title><style>${cssStyle}</style></head>
        <body>
          <h1>Statystyki odwiedzin</h1>
          <ul>${ipList || '<li>Brak danych</li>'}</ul>
          <p><a href="/">Powrót do strony głównej</a></p>
        </body>
        </html>
      `);

    } else if (pathname === '/form' && method === 'GET') {
      logAccess(ip, pathname, 200);
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Formularz</title><style>${cssStyle}</style></head>
        <body>
          <h1>Dodaj Gościa</h1>
          <form action="/add" method="POST">
            <input type="text" name="name" placeholder="Wpisz imię (max 50 znaków)" required>
            <input type="submit" value="Dodaj">
          </form>
          <p><a href="/">Powrót do strony głównej</a></p>
        </body>
        </html>
      `);

    } else if (pathname === '/add' && method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const postData = qs.parse(body);
          const nameValidation = validateName(postData.name);
          
          if (!nameValidation.valid) {
            logAccess(ip, pathname, 400);
            res.writeHead(400);
            res.end(`
              <!DOCTYPE html>
              <html lang="pl">
              <head><title>Błąd</title><style>${cssStyle}</style></head>
              <body>
                <h1 class="error">Błąd walidacji</h1>
                <p>${nameValidation.error}</p>
                <p><a href="/form">Spróbuj ponownie</a></p>
              </body>
              </html>
            `);
            return;
          }

          const name = nameValidation.value;
          const now = new Date().toISOString();
          
          try {
            const guests = await readGuests();
            guests.push({ name, date: now });
            await writeGuests(guests);

            logAccess(ip, pathname, 200);
            res.writeHead(200);
            res.end(`
              <!DOCTYPE html>
              <html lang="pl">
              <head><title>Sukces</title><style>${cssStyle}</style></head>
              <body>
                <h1>Sukces</h1>
                <p>Dodano gościa: <strong>${name}</strong></p>
                <p>Data: ${now}</p>
                <p><a href="/list">Zobacz listę gości</a> | <a href="/">Strona główna</a></p>
              </body>
              </html>
            `);
          } catch (fileErr) {
            logAccess(ip, pathname, 500);
            res.writeHead(500);
            res.end(get500Page(fileErr.message));
          }
        } catch (err) {
          logAccess(ip, pathname, 500);
          res.writeHead(500);
          res.end(get500Page('Błąd przetwarzania danych'));
        }
      });

    } else if (pathname === '/add' && method === 'GET') {
      const nameValidation = validateName(parsedUrl.query.name);
      
      if (!nameValidation.valid) {
        logAccess(ip, pathname, 400);
        res.writeHead(400);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Błąd</title><style>${cssStyle}</style></head>
          <body>
            <h1 class="error">Błąd: 400 Bad Request</h1>
            <p>${nameValidation.error}</p>
            <p><a href="/form">Użyj formularza</a></p>
          </body>
          </html>
        `);
        return;
      }

      const name = nameValidation.value;
      const now = new Date().toISOString();
      
      try {
        const guests = await readGuests();
        guests.push({ name, date: now });
        await writeGuests(guests);

        logAccess(ip, pathname, 200);
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Sukces</title><style>${cssStyle}</style></head>
          <body>
            <h1>Sukces</h1>
            <p>Dodano gościa: <strong>${name}</strong></p>
            <p><a href="/list">Zobacz listę</a></p>
          </body>
          </html>
        `);
      } catch (fileErr) {
        logAccess(ip, pathname, 500);
        res.writeHead(500);
        res.end(get500Page(fileErr.message));
      }

    } else if (pathname === '/list' && method === 'GET') {
      try {
        const guests = await readGuests();
        
        if (guests.length === 0) {
          logAccess(ip, pathname, 200);
          res.writeHead(200);
          res.end(`
            <!DOCTYPE html>
            <html lang="pl">
            <head><title>Lista Gości</title><style>${cssStyle}</style></head>
            <body>
              <h1>Lista gości</h1>
              <p class="warning">Lista gości jest pusta</p>
              <p><a href="/form">Dodaj pierwszego gościa</a></p>
            </body>
            </html>
          `);
          return;
        }
        
        let listItems = '';
        guests.forEach(guest => {
          listItems += `<li>${guest.name} - Dodano: ${guest.date}</li>`;
        });
        
        logAccess(ip, pathname, 200);
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Lista Gości</title><style>${cssStyle}</style></head>
          <body>
            <h1>Lista gości</h1>
            <ul>${listItems}</ul>
            <p><a href="/">Powrót do strony głównej</a></p>
          </body>
          </html>
        `);
      } catch (fileErr) {
        logAccess(ip, pathname, 500);
        res.writeHead(500);
        res.end(get500Page(fileErr.message));
      }

    } else if (pathname === '/remove' && method === 'GET') {
      const nameValidation = validateName(parsedUrl.query.name);
      
      if (!nameValidation.valid) {
        logAccess(ip, pathname, 400);
        res.writeHead(400);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Błąd</title><style>${cssStyle}</style></head>
          <body>
            <h1 class="error">Błąd: 400 Bad Request</h1>
            <p>${nameValidation.error}</p>
          </body>
          </html>
        `);
        return;
      }

      const name = nameValidation.value;
      
      try {
        let guests = await readGuests();
        const initialLength = guests.length;
        guests = guests.filter(guest => guest.name !== name);
        
        if (guests.length === initialLength) {
          logAccess(ip, pathname, 404);
          res.writeHead(404);
          res.end(`
            <!DOCTYPE html>
            <html lang="pl">
            <head><title>404</title><style>${cssStyle}</style></head>
            <body>
              <h1 class="error">404 - Nie znaleziono</h1>
              <p>Gość o imieniu "${name}" nie istnieje</p>
              <p><a href="/list">Zobacz listę gości</a></p>
            </body>
            </html>
          `);
          return;
        }
        
        await writeGuests(guests);
        logAccess(ip, pathname, 200);
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Sukces</title><style>${cssStyle}</style></head>
          <body>
            <h1>Sukces</h1>
            <p>Usunięto gościa: <strong>${name}</strong></p>
            <p><a href="/list">Zobacz listę</a></p>
          </body>
          </html>
        `);
      } catch (fileErr) {
        logAccess(ip, pathname, 500);
        res.writeHead(500);
        res.end(get500Page('Nie można usunąć gościa: ' + fileErr.message));
      }

    } else if (pathname === '/clear' && method === 'GET') {
      try {
        await writeGuests([]);
        logAccess(ip, pathname, 200);
        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Sukces</title><style>${cssStyle}</style></head>
          <body>
            <h1>Sukces</h1>
            <p>Lista gości została wyczyszczona</p>
            <p><a href="/">Powrót do strony głównej</a></p>
          </body>
          </html>
        `);
      } catch (fileErr) {
        logAccess(ip, pathname, 500);
        res.writeHead(500);
        res.end(get500Page(fileErr.message));
      }

    } else {
      logAccess(ip, pathname, 404);
      res.writeHead(404);
      res.end(get404Page());
    }
  } catch (err) {
    console.error('Błąd serwera:', err);
    logAccess(ip, pathname, 500);
    res.writeHead(500);
    res.end(get500Page('Wystąpił nieoczekiwany błąd'));
  }
});

server.listen(3000, () => {
  console.log('Serwer działa na porcie 3000');
  console.log('Dostępne endpointy:');
  console.log('  GET  /          - Strona główna');
  console.log('  GET  /stats     - Statystyki odwiedzin');
  console.log('  GET  /form      - Formularz dodawania gości');
  console.log('  POST /add       - Dodawanie gościa (POST)');
  console.log('  GET  /add?name= - Dodawanie gościa (GET)');
  console.log('  GET  /list      - Lista gości');
  console.log('  GET  /remove?name= - Usuwanie gościa');
  console.log('  GET  /clear     - Czyszczenie listy');
});