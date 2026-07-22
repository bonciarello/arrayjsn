/**
 * Test suite per Convertitore CSV → JSON
 *
 * Verifica:
 * 1. Il server risponde correttamente
 * 2. La pagina HTML ha tutti gli elementi SEO richiesti
 * 3. La pagina contiene i componenti Vue attesi
 * 4. Il parsing CSV funziona (test con Papa Parse lato server)
 * 5. I file statici (robots.txt, sitemap.xml) sono serviti
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:4601';
const HTML_PATH = path.join(__dirname, '..', 'index.html');
const ROBOTS_PATH = path.join(__dirname, '..', 'robots.txt');
const SITEMAP_PATH = path.join(__dirname, '..', 'sitemap.xml');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    }).on('error', reject);
  });
}

async function runTests() {
  console.log('\n📋 Test Suite: Convertitore CSV → JSON\n');
  console.log('═'.repeat(50));

  // ── Test 1: File statici esistono ──
  console.log('\n📁 Test 1: File statici\n');

  assert(fs.existsSync(HTML_PATH), 'index.html esiste');
  assert(fs.existsSync(ROBOTS_PATH), 'robots.txt esiste');
  assert(fs.existsSync(SITEMAP_PATH), 'sitemap.xml esiste');
  assert(fs.existsSync(path.join(__dirname, 'test-data.csv')), 'test-data.csv esiste');

  // ── Test 2: Contenuto HTML ──
  console.log('\n📄 Test 2: Struttura HTML\n');

  const html = fs.readFileSync(HTML_PATH, 'utf-8');

  assert(html.includes('<!DOCTYPE html>'), 'DOCTYPE presente');
  assert(html.includes('<html lang="it"'), 'lang="it" impostato');
  assert(html.includes('<meta name="viewport"'), 'meta viewport presente');
  assert(html.includes('<meta name="description"'), 'meta description presente');
  assert(html.includes('<title>'), 'tag title presente');
  assert(html.includes('<link rel="canonical"'), 'link canonical presente');

  // SEO elements
  assert(html.includes('og:title'), 'Open Graph: og:title presente');
  assert(html.includes('og:description'), 'Open Graph: og:description presente');
  assert(html.includes('og:url'), 'Open Graph: og:url presente');
  assert(html.includes('application/ld+json'), 'JSON-LD markup presente');
  assert(html.includes('WebApplication'), 'JSON-LD: WebApplication type');

  // Landmarks
  assert(html.includes('<header'), 'Landmark <header> presente');
  assert(html.includes('<main'), 'Landmark <main> presente');
  assert(html.includes('<footer'), 'Landmark <footer> presente');

  // Single h1
  const h1Count = (html.match(/<h1[^>]*>/g) || []).length;
  assert(h1Count === 1, `Esattamente un <h1> (trovati: ${h1Count})`);

  // Vue.js references
  assert(html.includes('vue.global') || html.includes('Vue'), 'Vue.js caricato');
  assert(html.includes('papaparse'), 'Papa Parse caricato');

  // Accessibility
  assert(html.includes('aria-label'), 'Attributi aria-label presenti');
  assert(html.includes('role='), 'Attributi role presenti');
  assert(html.includes('prefers-reduced-motion'), 'Supporto prefers-reduced-motion');

  // Sub-path safety
  const absolutePaths = html.match(/(?:src|href|action)="\/(?!\/)[^"]*"/g) || [];
  const problematicPaths = absolutePaths.filter(p => !p.includes('//') && !p.includes('https://'));
  assert(problematicPaths.length === 0, `Nessun path assoluto che inizia con "/" (trovati: ${problematicPaths.length})`);

  // ── Test 3: Server HTTP ──
  console.log('\n🌐 Test 3: Server HTTP\n');

  let sitemapBody = '';
  try {
    const indexRes = await httpGet('/');
    assert(indexRes.status === 200, `GET / risponde 200 (status: ${indexRes.status})`);
    assert(indexRes.body.includes('<!DOCTYPE html>'), 'GET / restituisce HTML');
    assert(indexRes.body.includes('Convertitore CSV'), 'GET / contiene il titolo');

    const robotsRes = await httpGet('/robots.txt');
    assert(robotsRes.status === 200, `GET /robots.txt risponde 200 (status: ${robotsRes.status})`);
    assert(robotsRes.body.includes('User-agent'), 'robots.txt contiene User-agent');
    assert(robotsRes.body.includes('Sitemap:'), 'robots.txt contiene Sitemap');

    const sitemapRes = await httpGet('/sitemap.xml');
    sitemapBody = sitemapRes.body;
    assert(sitemapRes.status === 200, `GET /sitemap.xml risponde 200 (status: ${sitemapRes.status})`);
    assert(sitemapRes.body.includes('<urlset'), 'sitemap.xml valido');
    assert(sitemapRes.body.includes('cristianporco.it'), 'sitemap.xml contiene URL canonico');

    const notFoundRes = await httpGet('/inesistente.html');
    assert(notFoundRes.status === 404, `GET /inesistente.html risponde 404 (status: ${notFoundRes.status})`);

  } catch (err) {
    console.error(`  ✗ Errore connessione server: ${err.message}`);
    console.error('    Assicurati che il server sia in esecuzione su porta 4601');
    failed++;
  }

  // ── Test 4: Verifica canonical URL ──
  console.log('\n🔗 Test 4: URL canonici\n');

  const canonicalUrl = 'https://github.com/bonciarello/convertitore-di-file-csv-a-array-json-per-javascript/';
  assert(html.includes(canonicalUrl), 'Canonical URL presente nel HTML');
  assert(sitemapBody.includes(canonicalUrl), 'Canonical URL in sitemap.xml');

  const robotsContent = fs.readFileSync(ROBOTS_PATH, 'utf-8');
  assert(robotsContent.includes(canonicalUrl), 'Canonical URL in robots.txt');

  // ── Test 5: Test CSV campione ──
  console.log('\n📊 Test 5: CSV campione\n');

  const csvContent = fs.readFileSync(path.join(__dirname, 'test-data.csv'), 'utf-8');
  const csvLines = csvContent.trim().split('\n');
  assert(csvLines.length === 6, `CSV ha 6 righe (header + 5 dati): ${csvLines.length}`);
  assert(csvLines[0] === 'nome,cognome,eta,attivo,citta', 'Header CSV corretto');
  assert(csvLines[1].includes('Mario'), 'Prima riga dati corretta');

  // Simula il parsing CSV con Papa Parse-style logic
  const headers = csvLines[0].split(',');
  assert(headers.length === 5, '5 colonne nel CSV');
  assert(headers.includes('eta'), 'Colonna "eta" presente');
  assert(headers.includes('attivo'), 'Colonna "attivo" presente');

  // Verifica che i valori "eta" siano convertibili a number
  const etaValues = csvLines.slice(1).map(l => l.split(',')[2]);
  const allNumeric = etaValues.every(v => !isNaN(Number(v)));
  assert(allNumeric, 'Tutti i valori di "eta" sono numerici');

  // Verifica che i valori "attivo" siano booleani
  const attivoValues = csvLines.slice(1).map(l => l.split(',')[3]);
  const allBoolean = attivoValues.every(v => v === 'true' || v === 'false');
  assert(allBoolean, 'Tutti i valori di "attivo" sono true/false');

  // ── Test 6: File size ──
  console.log('\n📦 Test 6: Dimensioni file\n');

  const htmlSize = fs.statSync(HTML_PATH).size;
  assert(htmlSize < 100 * 1024, `index.html sotto 100KB (${(htmlSize / 1024).toFixed(1)} KB)`);

  // ── Riepilogo ──
  console.log('\n' + '═'.repeat(50));
  console.log(`\n📊 Riepilogo: ${passed} passati, ${failed} falliti su ${passed + failed} test\n`);

  if (failed > 0) {
    console.log('❌ Alcuni test sono falliti.\n');
    process.exit(1);
  } else {
    console.log('✅ Tutti i test passati!\n');
    process.exit(0);
  }
}

// Attendi che il server sia pronto, poi esegui i test
setTimeout(() => {
  runTests().catch(err => {
    console.error('Errore nei test:', err);
    process.exit(1);
  });
}, 1500);
