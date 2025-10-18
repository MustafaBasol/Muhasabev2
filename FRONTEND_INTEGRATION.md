# 🎨 Frontend API Integration

## ✅ Tamamlanan Entegrasyonlar

### 1. API Client Setup
**Dosya**: `src/api/client.ts`
- Axios instance configured with base URL (http://localhost:3000)
- Request interceptor: Automatically adds Bearer token from localStorage
- Response interceptor: Handles 401 unauthorized → redirects to login
- Error handling for network failures

### 2. Authentication Service
**Dosya**: `src/api/auth.ts`
- `register()` - Yeni kullanıcı ve tenant kaydı
- `login()` - Email/password ile giriş, JWT token alır
- `getProfile()` - Mevcut kullanıcı bilgileri (GET /auth/me)
- `logout()` - LocalStorage'ı temizler

**Interfaces**:
```typescript
interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionPlan: string;
    status: string;
  };
  token: string;
}
```

### 3. Auth Context
**Dosya**: `src/contexts/AuthContext.tsx`
- React Context API ile global auth state yönetimi
- State: `user`, `tenant`, `isAuthenticated`, `isLoading`
- Methods: `login()`, `register()`, `logout()`
- Auto-loads user from localStorage on mount
- Provides `useAuth()` hook for components

**Usage**:
```typescript
import { useAuth } from '../contexts/AuthContext';

function MyComponent() {
  const { user, tenant, isAuthenticated, login, logout } = useAuth();
  
  // ...
}
```

### 4. Updated Components

#### LoginPage (`src/components/LoginPage.tsx`)
- ✅ Uses `useAuth()` hook instead of demo login
- ✅ Async form submission with error handling
- ✅ Updated demo credentials: admin@test.com / Test123456
- ✅ Displays API error messages
- ✅ Loading state during login
- ✅ Remember me functionality

#### App.tsx (`src/App.tsx`)
- ✅ Uses `useAuth()` for authentication state
- ✅ `isAuthenticated` check instead of `isLoggedIn`
- ✅ Calls `logout()` from context
- ✅ AuthProvider wrapped in main.tsx

#### main.tsx (`src/main.tsx`)
- ✅ Wrapped App with `<AuthProvider>`
- ✅ All child components have access to auth context

## 🔐 Authentication Flow

### Register Flow
```
User fills form → LoginPage.register()
  → authService.register(data)
  → POST /auth/register
  → Backend creates User + Tenant
  → Returns { user, tenant, token }
  → AuthContext stores in localStorage
  → User logged in automatically
```

### Login Flow
```
User enters credentials → LoginPage.login()
  → authService.login({ email, password })
  → POST /auth/login
  → Backend validates credentials
  → Returns JWT token
  → AuthContext stores token + user + tenant
  → Axios interceptor adds token to future requests
  → App.tsx renders main interface
```

### Logout Flow
```
User clicks logout → App.handleLogout()
  → authContext.logout()
  → Clears localStorage (token, user, tenant)
  → AuthContext sets user = null
  → App.tsx detects !isAuthenticated
  → Redirects to LoginPage
```

### Auto-Login Flow
```
User refreshes page → AuthProvider useEffect()
  → Checks localStorage for token
  → If found, sets user/tenant from localStorage
  → App renders main interface
  → Token will be validated on first API call
```

## 🚀 Running the System

### Backend (Terminal 1)
```bash
cd /workspaces/backend
docker-compose up -d  # Start PostgreSQL, Redis, pgAdmin
npm run start:dev     # Start NestJS API
```
**Access**: http://localhost:3000
**Swagger**: http://localhost:3000/api

### Frontend (Terminal 2)
```bash
cd /workspaces/Muhasabev2
npm run dev
```
**Access**: http://localhost:5174

## 🧪 Test the Integration

1. **Open Frontend**: http://localhost:5174
2. **Login** with demo account:
   - Email: admin@test.com
   - Password: Test123456
3. **Check Browser Console** for API calls
4. **Check Network Tab** to see JWT token in headers
5. **Verify localStorage** has:
   - `auth_token`
   - `user`
   - `tenant`

## 📦 Dependencies Installed

```json
{
  "dependencies": {
    "axios": "^1.7.9"  // ← NEW
  }
}
```

## 🔥 Next Steps for Full Integration

### 1. Customer Management API
**Create**: `src/api/customers.ts`
```typescript
import { apiClient } from './client';

export const customersService = {
  getAll: () => apiClient.get('/customers'),
  getById: (id: string) => apiClient.get(`/customers/${id}`),
  create: (data: any) => apiClient.post('/customers', data),
  update: (id: string, data: any) => apiClient.patch(`/customers/${id}`, data),
  delete: (id: string) => apiClient.delete(`/customers/${id}`),
};
```

**Update**: `src/components/CustomerList.tsx`
- Replace mock data with `customersService.getAll()`
- Use React Query or useState with useEffect

### 2. Product Management API
**Create**: `src/api/products.ts`
- Similar structure to customers
- Add `getLowStock()` method

### 3. Invoice Management API
**Create**: `src/api/invoices.ts`
- Handle JSONB line items
- Status filtering

### 4. Expense Management API
**Create**: `src/api/expenses.ts`
- Approval workflow methods

### 5. Supplier Management API
**Create**: `src/api/suppliers.ts`

## �� Debugging Tips

### Token Issues
```javascript
// Check token in console
console.log(localStorage.getItem('auth_token'));

// Test token with curl
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/auth/me
```

### Network Errors
- Check if backend is running: `curl http://localhost:3000`
- Verify CORS is enabled in NestJS (it is, in main.ts)
- Check browser console for CORS errors

### Auto-Logout (401 Errors)
- Token expired (7 days default)
- Token invalid or tampered
- Backend restarted and secret changed

## 📊 Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Auth Context | ✅ Complete | Provides global auth state |
| Login API Integration | ✅ Complete | Works with backend |
| Register API Integration | ✅ Complete | Creates user + tenant |
| Auto-login from localStorage | ✅ Complete | Persists across refreshes |
| Token in axios headers | ✅ Complete | Automatic via interceptor |
| 401 redirect to login | ✅ Complete | Automatic via interceptor |
| Customer API | 🔜 Pending | Service file not created |
| Product API | 🔜 Pending | Service file not created |
| Invoice API | 🔜 Pending | Service file not created |
| Expense API | 🔜 Pending | Service file not created |
| Supplier API | 🔜 Pending | Service file not created |

## 🎯 Demo Scenario

1. **First Time User**:
   - Open http://localhost:5174
   - Click "Ücretsiz deneme başlatın"
   - Fill registration form
   - Backend creates new tenant + admin user
   - Automatically logged in with JWT token
   - Dashboard loads with empty data

2. **Returning User**:
   - Open http://localhost:5174
   - Already sees dashboard (auto-login from localStorage)
   - Token validated on first API call
   - If token expired, redirected to login

3. **Demo Account**:
   - Email: admin@test.com
   - Password: Test123456
   - Login → Dashboard loads
   - Check Network tab: See `Authorization: Bearer eyJh...` in requests

---

**Status**: ✅ Basic Integration Complete
**Last Updated**: 2025-10-18
**Developer**: GitHub Copilot
