const http = require('http');
const fs = require('fs').promises;
const url = require('url');
const qs = require('querystring'); // For parsing POST body

let visitCount = 0; // Global visit counter
const ipVisits = {}; // Dictionary for per-IP visit counts
const guestsFile = 'guests.json'; // JSON file for guests

// CSS styling
const cssStyle = `
  body { font-family: Arial, sans-serif; background-color: #f4f4f4; color: #333; padding: 20px; }
  h1 { color: #007bff; }
  ul { list-style-type: none; padding: 0; }
  li { background: #fff; margin: 10px 0; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
  form { max-width: 400px; margin: 20px 0; }
  input[type="text"], input[type="submit"] { padding: 10px; margin: 5px 0; width: 100%; box-sizing: border-box; }
  input[type="submit"] { background-color: #007bff; color: white; border: none; cursor: pointer; }
  input[type="submit"]:hover { background-color: #0056b3; }
`;

// Function to read guests from JSON
async function readGuests() {
  try {
    const data = await fs.readFile(guestsFile, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return []; // Return empty array if file doesn't exist
    }
    throw err;
  }
}

// Function to write guests to JSON
async function writeGuests(guests) {
  await fs.writeFile(guestsFile, JSON.stringify(guests, null, 2));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Get client IP (simplified, no proxy handling)
  const ip = req.connection.remoteAddress;

  // Increment visit counters
  visitCount++;
  if (!ipVisits[ip]) ipVisits[ip] = 0;
  ipVisits[ip]++;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  try {
    if (pathname === '/' && method === 'GET') {
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Strona Główna</title><style>${cssStyle}</style></head>
        <body>
          <h1>Witaj na stronie!</h1>
          <p>Odwiedziłeś ją już ${visitCount} razy.</p>
        </body>
        </html>
      `);

    } else if (pathname === '/stats' && method === 'GET') {
      // Show IP visit stats
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
        </body>
        </html>
      `);

    } else if (pathname === '/form' && method === 'GET') {
      // Form for adding guests
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Formularz</title><style>${cssStyle}</style></head>
        <body>
          <h1>Dodaj Gościa</h1>
          <form action="/add" method="POST">
            <input type="text" name="name" placeholder="Wpisz imię" required>
            <input type="submit" value="Dodaj">
          </form>
        </body>
        </html>
      `);

    } else if (pathname === '/add' && method === 'POST') {
      // Handle POST request to add guest
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        const postData = qs.parse(body);
        const name = postData.name;
        if (!name) {
          res.writeHead(400);
          res.end(`
            <!DOCTYPE html>
            <html lang="pl">
            <head><title>Błąd</title><style>${cssStyle}</style></head>
            <body><h1>Błąd</h1><p>Pole "name" jest wymagane!</p></body>
            </html>
          `);
          return;
        }

        const now = new Date().toISOString();
        const guests = await readGuests();
        guests.push({ name, date: now });
        await writeGuests(guests);

        res.writeHead(200);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Sukces</title><style>${cssStyle}</style></head>
          <body><h1>Sukces</h1><p>Dodano gościa: ${name} (${now})</p></body>
          </html>
        `);
      });

    } else if (pathname === '/add' && method === 'GET') {
      // Keep original GET /add for backward compatibility
      const name = parsedUrl.query.name;
      if (!name) {
        res.writeHead(400);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Błąd</title><style>${cssStyle}</style></head>
          <body><h1>Błąd</h1><p>Parametr "name" jest wymagany!</p></body>
          </html>
        `);
        return;
      }

      const now = new Date().toISOString();
      const guests = await readGuests();
      guests.push({ name, date: now });
      await writeGuests(guests);

      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Sukces</title><style>${cssStyle}</style></head>
        <body><h1>Sukces</h1><p>Dodano gościa: ${name} (${now})</p></body>
        </html>
      `);

    } else if (pathname === '/list' && method === 'GET') {
      // List guests from JSON
      const guests = await readGuests();
      let listItems = '';
      guests.forEach(guest => {
        listItems += `<li>${guest.name} - Dodano: ${guest.date}</li>`;
      });
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Lista Gości</title><style>${cssStyle}</style></head>
        <body>
          <h1>Lista gości</h1>
          ${listItems ? `<ul>${listItems}</ul>` : '<p>Lista gości jest pusta</p>'}
        </body>
        </html>
      `);

    } else if (pathname === '/remove' && method === 'GET') {
      // Remove guest by name
      const name = parsedUrl.query.name;
      if (!name) {
        res.writeHead(400);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Błąd</title><style>${cssStyle}</style></head>
          <body><h1>Błąd</h1><p>Parametr "name" jest wymagany!</p></body>
          </html>
        `);
        return;
      }

      let guests = await readGuests();
      const initialLength = guests.length;
      guests = guests.filter(guest => guest.name !== name);
      if (guests.length === initialLength) {
        res.writeHead(404);
        res.end(`
          <!DOCTYPE html>
          <html lang="pl">
          <head><title>Błąd</title><style>${cssStyle}</style></head>
          <body><h1>Błąd</h1><p>Gość o imieniu "${name}" nie istnieje</p></body>
          </html>
        `);
        return;
      }
      await writeGuests(guests);
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Sukces</title><style>${cssStyle}</style></head>
        <body><h1>Sukces</h1><p>Usunięto gościa: ${name}</p></body>
        </html>
      `);

    } else if (pathname === '/clear' && method === 'GET') {
      // Clear guests.json
      await writeGuests([]);
      res.writeHead(200);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>Sukces</title><style>${cssStyle}</style></head>
        <body><h1>Sukces</h1><p>Zawartość pliku guests.json została usunięta</p></body>
        </html>
      `);

    } else {
      res.writeHead(404);
      res.end(`
        <!DOCTYPE html>
        <html lang="pl">
        <head><title>404</title><style>${cssStyle}</style></head>
        <body><h1>404 - Strona nie istnieje</h1></body>
        </html>
      `);
    }
  } catch (err) {
    res.writeHead(500);
    res.end(`
      <!DOCTYPE html>
      <html lang="pl">
      <head><title>Błąd</title><style>${cssStyle}</style></head>
      <body><h1>Błąd serwera</h1><p>Wystąpił nieoczekiwany błąd</p></body>
      </html>
    `);
    console.error(err);
  }
});

server.listen(3000, () => {
  console.log('Serwer działa na porcie 3000');
});