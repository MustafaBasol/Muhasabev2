const http = require('http');

// Mock users from database backup
const mockUsers = [
  {
    id: '1a38a36b-f16e-4ead-8627-73c9ebcc9024',
    email: 'admin@test.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'tenant_admin',
    tenantId: '26b93df7-9d6f-4d26-b082-f2d806096c9c'
  },
  {
    id: 'f66c54d8-5b5c-4b7f-b5ed-fc00251cf7e7',
    email: 'testdemo@example.com',
    firstName: 'Test',
    lastName: 'Demo',
    role: 'tenant_admin',
    tenantId: '1c3e8b69-4796-4362-a71f-fec03308dbe4'
  },
  {
    id: '2e145c6e-6d49-4d11-bd56-8c361a9665ce',
    email: 'demo@test.com',
    firstName: 'Demo',
    lastName: 'User',
    role: 'tenant_admin',
    tenantId: '864bd5e5-8d5d-46a4-824a-c69c39703fc9'
  },
  {
    id: 'aded27bd-7192-4f72-81f6-060858d2f89b',
    email: 'superadmin@test.com',
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    tenantId: '26b93df7-9d6f-4d26-b082-f2d806096c9c'
  },
  {
    id: '24f96336-536e-4353-b200-0ed6bdf1fae1',
    email: 'accountant1@test.com',
    firstName: 'Ahmet',
    lastName: 'Yılmaz',
    role: 'accountant',
    tenantId: '26b93df7-9d6f-4d26-b082-f2d806096c9c'
  },
  {
    id: 'a8b99389-99cf-4d05-8b93-f8e46ad01b5b',
    email: 'user3@test.com',
    firstName: 'Ayşe',
    lastName: 'Kaya',
    role: 'accountant',
    tenantId: '48ee2d2d-cad8-4518-a652-c1a5284efefd'
  },
  {
    id: '394e3bcc-9fe5-4e88-bd25-5e32d35a1169',
    email: 'user2@test.com',
    firstName: 'User',
    lastName: 'Two',
    role: 'user',
    tenantId: 'e2dedaf4-2605-4614-8dda-d8745d19d214'
  }
];

const mockTenants = {
  '26b93df7-9d6f-4d26-b082-f2d806096c9c': {
    id: '26b93df7-9d6f-4d26-b082-f2d806096c9c',
    name: 'Demo Şirket 1',
    slug: 'demo-sirket-1',
    companyName: 'Demo Ticaret A.Ş.',
    taxNumber: '1234567890',
    address: 'İstanbul, Türkiye',
    phone: '+90 555 111 2233',
    email: 'demo1@test.com',
    subscriptionPlan: 'professional',
    status: 'active',
    // Legal compliance fields
    website: 'https://demo1.com',
    taxOffice: 'Istanbul Tax Office',
    mersisNumber: '1234567890123456',
    kepAddress: 'demo1@hs02.kep.tr',
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
  },
  '1c3e8b69-4796-4362-a71f-fec03308dbe4': {
    id: '1c3e8b69-4796-4362-a71f-fec03308dbe4',
    name: 'Test Demo Company',
    slug: 'test-demo-company',
    companyName: 'Test Demo Ltd.',
    taxNumber: '9876543210',
    subscriptionPlan: 'basic',
    status: 'active'
  },
  '864bd5e5-8d5d-46a4-824a-c69c39703fc9': {
    id: '864bd5e5-8d5d-46a4-824a-c69c39703fc9',
    name: 'Demo User',
    slug: 'demo-user',
    subscriptionPlan: 'free',
    status: 'trial'
  },
  'e2dedaf4-2605-4614-8dda-d8745d19d214': {
    id: 'e2dedaf4-2605-4614-8dda-d8745d19d214',
    name: 'Demo Şirket 2',
    slug: 'demo-sirket-2',
    companyName: 'Örnek Danışmanlık Ltd.',
    taxNumber: '9876543210',
    subscriptionPlan: 'basic',
    status: 'active'
  },
  '48ee2d2d-cad8-4518-a652-c1a5284efefd': {
    id: '48ee2d2d-cad8-4518-a652-c1a5284efefd',
    name: 'Test Organizasyon',
    slug: 'test-organizasyon',
    companyName: 'Test Muhasebe Ltd.',
    taxNumber: '5555555555',
    subscriptionPlan: 'enterprise',
    status: 'active'
  }
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = req.url;
  console.log(`${req.method} ${url}`);

  if (url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
  } else if (url === '/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const { email } = JSON.parse(body);
        const user = mockUsers.find(u => u.email === email);
        
        if (user) {
          const tenant = mockTenants[user.tenantId];
          res.writeHead(200);
          res.end(JSON.stringify({ 
            token: 'mock-jwt-token',
            user: {
              id: user.id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              role: user.role,
              tenantId: user.tenantId
            },
            tenant: tenant || {
              id: user.tenantId,
              name: 'Unknown Tenant',
              slug: 'unknown',
              subscriptionPlan: 'basic',
              status: 'active'
            }
          }));
        } else {
          res.writeHead(401);
          res.end(JSON.stringify({ message: 'Invalid credentials' }));
        }
      } catch (error) {
        res.writeHead(400);
        res.end(JSON.stringify({ message: 'Invalid request body' }));
      }
    });
  } else if (url === '/tenants/current' && req.method === 'GET') {
    // In a real scenario, we'd get the tenant ID from the JWT token
    // For mock, we'll return the first tenant
    const firstTenant = Object.values(mockTenants)[0];
    res.writeHead(200);
    res.end(JSON.stringify(firstTenant));
  } else if (url.startsWith('/tenants/') && req.method === 'PATCH') {
    const firstTenant = Object.values(mockTenants)[0];
    res.writeHead(200);
    res.end(JSON.stringify({ ...firstTenant, updatedAt: new Date().toISOString() }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ message: 'Mock API - Route not found' }));
  }
});

const PORT = 3000;
server.listen(PORT, 'localhost', () => {
  console.log(`🚀 Simple Mock API running on http://localhost:${PORT}`);
});