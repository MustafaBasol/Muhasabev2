const { createServer } = require('http');
const { URL } = require('url');

const mockTenant = {
  id: 'tenant-1',
  name: 'Demo Company',
  slug: 'demo-company',
  companyName: 'Demo Company Ltd.',
  taxNumber: '1234567890',
  website: 'https://demo.com',
  taxOffice: 'Istanbul Tax Office',
  mersisNumber: '1234567890123456',
  kepAddress: 'demo@hs02.kep.tr',
  siretNumber: '12345678901234',
  sirenNumber: '123456789',
  apeCode: '6201Z',
  tvaNumber: 'FR12345678901',
  rcsNumber: 'RCS Paris 123456789',
  steuernummer: '123/456/78901',
  umsatzsteuerID: 'DE123456789',
  handelsregisternummer: 'HRB 12345',
  finanzamt: 'Berlin Mitte',
  einNumber: '12-3456789',
  taxIDNumber: '987-65-4321',
  businessLicense: 'BL123456',
  salesTaxNumber: 'ST987654'
};

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  res.setHeader('Content-Type', 'application/json');
  
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else if (url.pathname === '/tenants/current') {
    res.writeHead(200);
    res.end(JSON.stringify(mockTenant));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Mock API - Route not found' }));
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
});