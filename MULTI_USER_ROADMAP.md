# 🚀 Çok Kullanıcılı Sistem Yol Haritası

## 📋 İçindekiler
1. [Genel Bakış](#genel-bakış)
2. [Mimari Tasarım](#mimari-tasarım)
3. [Faz 1: Backend Altyapısı](#faz-1-backend-altyapısı)
4. [Faz 2: Authentication & Authorization](#faz-2-authentication--authorization)
5. [Faz 3: Multi-Tenancy](#faz-3-multi-tenancy)
6. [Faz 4: Frontend Entegrasyonu](#faz-4-frontend-entegrasyonu)
7. [Faz 5: İleri Seviye Özellikler](#faz-5-ileri-seviye-özellikler)
8. [Güvenlik Gereksinimleri](#güvenlik-gereksinimleri)
9. [Veritabanı Şeması](#veritabanı-şeması)
10. [Teknoloji Yığını](#teknoloji-yığını)
11. [Zaman Çizelgesi](#zaman-çizelgesi)

---

## Genel Bakış

### Mevcut Durum
- ✅ Single-user React aplikasyonu
- ✅ LocalStorage tabanlı veri saklama
- ✅ Demo authentication
- ❌ Backend yok
- ❌ Gerçek kullanıcı yönetimi yok
- ❌ Veri senkronizasyonu yok

### Hedef Durum
- ✅ Multi-user SaaS platformu
- ✅ Gerçek backend API
- ✅ PostgreSQL/MongoDB veritabanı
- ✅ JWT tabanlı authentication
- ✅ Role-based access control (RBAC)
- ✅ Multi-tenant architecture
- ✅ Real-time senkronizasyon
- ✅ Subscription & billing

---

## Mimari Tasarım

### 1. Sistem Mimarisi

```
┌─────────────────────────────────────────────────────┐
│                  Frontend (React)                    │
│  - TypeScript                                        │
│  - Vite                                              │
│  - Tailwind CSS                                      │
│  - React Query (data fetching)                       │
│  - Zustand (state management)                        │
└───────────────────┬─────────────────────────────────┘
                    │ HTTPS/WSS
                    ▼
┌─────────────────────────────────────────────────────┐
│              API Gateway / Load Balancer            │
│  - NGINX / Traefik                                   │
│  - Rate Limiting                                     │
│  - SSL/TLS                                           │
└───────────────────┬─────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│              Backend API (Node.js/NestJS)           │
│  - RESTful API                                       │
│  - WebSocket (real-time)                            │
│  - Authentication Service                            │
│  - Business Logic                                    │
└───────────────────┬─────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌──────────────────┐   ┌──────────────────┐
│   PostgreSQL     │   │     Redis        │
│  - Primary DB    │   │  - Cache         │
│  - Transactions  │   │  - Sessions      │
│  - ACID          │   │  - Real-time     │
└──────────────────┘   └──────────────────┘
        │
        ▼
┌──────────────────┐
│   File Storage   │
│  - AWS S3 /      │
│    Cloudinary    │
│  - PDF Files     │
│  - Receipts      │
└──────────────────┘
```

### 2. Multi-Tenancy Stratejisi

#### Seçenek A: Database-per-Tenant (En Güvenli)
```
Tenant 1 → Database 1
Tenant 2 → Database 2
Tenant 3 → Database 3
```
**Artıları**: En yüksek izolasyon, kolay migration, daha güvenli
**Eksileri**: Maliyet yüksek, yönetim karmaşık

#### Seçenek B: Schema-per-Tenant (Önerilen)
```
Shared Database
  ├─ tenant_1_schema
  ├─ tenant_2_schema
  └─ tenant_3_schema
```
**Artıları**: İyi izolasyon, makul maliyet, kolay yönetim
**Eksileri**: Aynı DB'de, migration dikkat gerektirir

#### Seçenek C: Shared Schema (En Ekonomik)
```
Shared Database & Schema
  └─ tenant_id column in all tables
```
**Artıları**: En düşük maliyet, kolay scale
**Eksileri**: Güvenlik riski, dikkatli kod gerekli

**🎯 ÖNERİ: Seçenek B (Schema-per-Tenant)**

---

## Faz 1: Backend Altyapısı

### 1.1 Backend Framework Seçimi

#### Seçenek 1: Node.js + NestJS (Önerilen)
```bash
#장점
- TypeScript native
- Modüler mimari
- Built-in dependency injection
- Decorators ve metadata
- Mükemmel dökümantasyon
- PostgreSQL/MongoDB desteği
```

#### Seçenek 2: Node.js + Express
```bash
#장점
- Minimal ve esnek
- Geniş ecosystem
- Hızlı başlangıç

# Eksi
- Manual configuration
- Less opinionated
```

#### Seçenek 3: Python + FastAPI
```bash
#장점
- Hızlı development
- Auto API docs
- Type hints

# Eksi
- Frontend ile farklı dil
- Ecosystem farklı
```

**🎯 ÖNERİ: NestJS (TypeScript consistency)**

### 1.2 Proje Yapısı (NestJS)

```
backend/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── guards/
│   │   ├── strategies/
│   │   └── dto/
│   ├── users/                   # User management
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── entities/
│   │   └── dto/
│   ├── tenants/                 # Tenant management
│   │   ├── tenants.controller.ts
│   │   ├── tenants.service.ts
│   │   └── middleware/
│   ├── customers/               # Business logic
│   ├── invoices/
│   ├── expenses/
│   ├── sales/
│   ├── reports/
│   ├── common/                  # Shared utilities
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   └── pipes/
│   ├── database/                # DB configuration
│   │   ├── migrations/
│   │   └── seeds/
│   └── main.ts
├── test/
├── .env
├── .env.example
├── package.json
└── tsconfig.json
```

### 1.3 İlk Adımlar (Hafta 1-2)

```bash
# 1. NestJS projesi oluştur
npm i -g @nestjs/cli
nest new backend

# 2. Gerekli paketleri kur
cd backend
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install @nestjs/config
npm install bcrypt
npm install class-validator class-transformer

# 3. Development dependencies
npm install -D @types/passport-jwt @types/bcrypt

# 4. Docker Compose ile PostgreSQL
docker-compose up -d
```

### 1.4 Docker Compose Yapılandırması

```yaml
# backend/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: moneyflow_dev
      POSTGRES_USER: moneyflow
      POSTGRES_PASSWORD: your_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  pgadmin:
    image: dpage/pgadmin4
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@moneyflow.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres

volumes:
  postgres_data:
  redis_data:
```

---

## Faz 2: Authentication & Authorization

### 2.1 Kullanıcı Modeli

```typescript
// backend/src/users/entities/user.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { Tenant } from '../../tenants/entities/tenant.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  TENANT_ADMIN = 'tenant_admin',
  ACCOUNTANT = 'accountant',
  VIEWER = 'viewer',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  passwordHash: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.VIEWER })
  role: UserRole;

  @ManyToOne(() => Tenant, tenant => tenant.users)
  tenant: Tenant;

  @Column()
  tenantId: string;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true })
  lastLoginAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### 2.2 JWT Authentication Flow

```typescript
// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.usersService.updateLastLogin(user.id);

    // Generate tokens
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async register(registerDto: RegisterDto) {
    // 1. Create tenant
    const tenant = await this.tenantsService.create({
      name: registerDto.companyName,
      subdomain: registerDto.subdomain,
    });

    // 2. Hash password
    const passwordHash = await bcrypt.hash(registerDto.password, 10);

    // 3. Create admin user
    const user = await this.usersService.create({
      email: registerDto.email,
      passwordHash,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      role: UserRole.TENANT_ADMIN,
      tenantId: tenant.id,
    });

    return this.login(user.email, registerDto.password);
  }
}
```

### 2.3 Guards ve Decorators

```typescript
// backend/src/auth/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler());
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

// backend/src/auth/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../users/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<UserRole[]>('roles', context.getHandler());
    
    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return requiredRoles.includes(user.role);
  }
}

// backend/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);

// Kullanım örneği:
// @Roles(UserRole.TENANT_ADMIN, UserRole.ACCOUNTANT)
// @UseGuards(JwtAuthGuard, RolesGuard)
```

### 2.4 API Endpoints (Hafta 3-4)

```typescript
// backend/src/auth/auth.controller.ts
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  @Public()
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @Public()
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.email, loginDto.password);
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() refreshDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshDto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: User) {
    return this.authService.logout(user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }

  @Post('forgot-password')
  @Public()
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @Post('reset-password')
  @Public()
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(
      resetPasswordDto.token,
      resetPasswordDto.newPassword,
    );
  }
}
```

---

## Faz 3: Multi-Tenancy

### 3.1 Tenant Modeli

```typescript
// backend/src/tenants/entities/tenant.entity.ts
import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum SubscriptionPlan {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  subdomain: string;

  @Column({ type: 'enum', enum: SubscriptionPlan, default: SubscriptionPlan.FREE })
  subscriptionPlan: SubscriptionPlan;

  @Column({ nullable: true })
  subscriptionExpiresAt: Date;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'json', nullable: true })
  settings: Record<string, any>;

  @OneToMany(() => User, user => user.tenant)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;
}
```

### 3.2 Tenant Middleware

```typescript
// backend/src/tenants/middleware/tenant.middleware.ts
import { Injectable, NestMiddleware, NotFoundException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantsService } from '../tenants.service';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Subdomain'den tenant'ı belirle
    const subdomain = this.extractSubdomain(req.hostname);
    
    if (subdomain) {
      const tenant = await this.tenantsService.findBySubdomain(subdomain);
      
      if (!tenant || !tenant.isActive) {
        throw new NotFoundException('Tenant not found');
      }
      
      req['tenantId'] = tenant.id;
      req['tenant'] = tenant;
    }
    
    next();
  }

  private extractSubdomain(hostname: string): string | null {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
    return null;
  }
}
```

### 3.3 Tenant Interceptor (Row-Level Security)

```typescript
// backend/src/common/interceptors/tenant.interceptor.ts
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (user) {
      // Her sorguya otomatik tenant filtresi ekle
      request.query = {
        ...request.query,
        tenantId: user.tenantId,
      };
    }
    
    return next.handle();
  }
}
```

### 3.4 Database Queries (Tenant-Aware)

```typescript
// backend/src/customers/customers.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from './entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
  ) {}

  async findAll(tenantId: string): Promise<Customer[]> {
    return this.customersRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, tenantId: string): Promise<Customer> {
    return this.customersRepository.findOne({
      where: { id, tenantId },
    });
  }

  async create(createCustomerDto: CreateCustomerDto, tenantId: string): Promise<Customer> {
    const customer = this.customersRepository.create({
      ...createCustomerDto,
      tenantId,
    });
    return this.customersRepository.save(customer);
  }

  async update(id: string, updateCustomerDto: UpdateCustomerDto, tenantId: string): Promise<Customer> {
    await this.customersRepository.update(
      { id, tenantId },
      updateCustomerDto,
    );
    return this.findOne(id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.customersRepository.delete({ id, tenantId });
  }
}
```

---

## Faz 4: Frontend Entegrasyonu

### 4.1 API Client Setup

```typescript
// frontend/src/api/client.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { secureStorage } from '../utils/storage';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor - Add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = secureStorage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - Handle errors & refresh token
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const originalRequest = error.config as any;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = secureStorage.getItem('refreshToken');
            const response = await this.client.post('/auth/refresh', { refreshToken });
            const { accessToken } = response.data;

            secureStorage.setItem('accessToken', accessToken);
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;

            return this.client(originalRequest);
          } catch (refreshError) {
            // Refresh failed, logout
            secureStorage.removeItem('accessToken');
            secureStorage.removeItem('refreshToken');
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  get<T>(url: string, config = {}) {
    return this.client.get<T>(url, config);
  }

  post<T>(url: string, data?: any, config = {}) {
    return this.client.post<T>(url, data, config);
  }

  put<T>(url: string, data?: any, config = {}) {
    return this.client.put<T>(url, data, config);
  }

  patch<T>(url: string, data?: any, config = {}) {
    return this.client.patch<T>(url, data, config);
  }

  delete<T>(url: string, config = {}) {
    return this.client.delete<T>(url, config);
  }
}

export const apiClient = new ApiClient();
```

### 4.2 React Query Setup

```bash
# Frontend dependencies
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install axios
npm install zustand
```

```typescript
// frontend/src/main.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
```

### 4.3 API Hooks

```typescript
// frontend/src/api/hooks/useAuth.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import { useAuthStore } from '../../stores/authStore';

interface LoginDto {
  email: string;
  password: string;
}

interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  companyName: string;
  subdomain: string;
}

export const useLogin = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (credentials: LoginDto) =>
      apiClient.post('/auth/login', credentials),
    onSuccess: (response) => {
      const { accessToken, refreshToken, user } = response.data;
      setAuth(accessToken, refreshToken, user);
    },
  });
};

export const useRegister = () => {
  const setAuth = useAuthStore((state) => state.setAuth);

  return useMutation({
    mutationFn: (data: RegisterDto) =>
      apiClient.post('/auth/register', data),
    onSuccess: (response) => {
      const { accessToken, refreshToken, user } = response.data;
      setAuth(accessToken, refreshToken, user);
    },
  });
};

export const useLogout = () => {
  const clearAuth = useAuthStore((state) => state.clearAuth);

  return useMutation({
    mutationFn: () => apiClient.post('/auth/logout'),
    onSuccess: () => {
      clearAuth();
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.get('/auth/me'),
    retry: false,
  });
};
```

```typescript
// frontend/src/api/hooks/useCustomers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { Customer } from '../../types';

export const useCustomers = () => {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const response = await apiClient.get<Customer[]>('/customers');
      return response.data;
    },
  });
};

export const useCustomer = (id: string) => {
  return useQuery({
    queryKey: ['customers', id],
    queryFn: async () => {
      const response = await apiClient.get<Customer>(`/customers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Customer>) =>
      apiClient.post<Customer>('/customers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Customer> }) =>
      apiClient.put<Customer>(`/customers/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers', variables.id] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    },
  });
};
```

### 4.4 Zustand State Management

```typescript
// frontend/src/stores/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { secureStorage } from '../utils/storage';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      setAuth: (accessToken, refreshToken, user) => {
        secureStorage.setItem('accessToken', accessToken);
        secureStorage.setItem('refreshToken', refreshToken);
        set({ user, isAuthenticated: true });
      },
      clearAuth: () => {
        secureStorage.removeItem('accessToken');
        secureStorage.removeItem('refreshToken');
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

### 4.5 Protected Routes

```typescript
// frontend/src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';

export const ProtectedRoute = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

// frontend/src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          {/* ... diğer protected routes */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Faz 5: İleri Seviye Özellikler

### 5.1 Real-time Updates (WebSocket)

```typescript
// backend/src/websocket/websocket.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { WsJwtGuard } from '../auth/guards/ws-jwt.guard';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
@UseGuards(WsJwtGuard)
export class WebsocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    const tenantId = client.handshake.auth.tenantId;
    client.join(`tenant:${tenantId}`);
    console.log(`Client ${client.id} connected to tenant ${tenantId}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client ${client.id} disconnected`);
  }

  // Broadcast to all clients in a tenant
  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, data);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket): string {
    return 'pong';
  }
}

// Usage in service
@Injectable()
export class CustomersService {
  constructor(private websocketGateway: WebsocketGateway) {}

  async create(data, tenantId) {
    const customer = await this.repository.save({ ...data, tenantId });
    
    // Notify all connected clients
    this.websocketGateway.emitToTenant(tenantId, 'customer:created', customer);
    
    return customer;
  }
}
```

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { useQueryClient } from '@tanstack/react-query';

let socket: Socket | null = null;

export const useWebSocket = () => {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
      auth: {
        token: secureStorage.getItem('accessToken'),
        tenantId: user.tenantId,
      },
    });

    // Listen for real-time updates
    socket.on('customer:created', () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    });

    socket.on('invoice:created', () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    });

    return () => {
      socket?.disconnect();
    };
  }, [user, queryClient]);

  return socket;
};
```

### 5.2 Subscription & Billing

```typescript
// backend/src/subscriptions/subscriptions.service.ts
import Stripe from 'stripe';

@Injectable()
export class SubscriptionsService {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  async createCheckoutSession(tenantId: string, plan: SubscriptionPlan) {
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: this.getPriceId(plan),
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/subscription/success`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        tenantId,
        plan,
      },
    });

    return { sessionId: session.id, url: session.url };
  }

  async handleWebhook(event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionCancelled(event.data.object);
        break;
    }
  }
}
```

### 5.3 Audit Logging

```typescript
// backend/src/audit/audit.service.ts
@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
  ) {}

  async log(entry: {
    userId: string;
    tenantId: string;
    action: string;
    resource: string;
    resourceId?: string;
    changes?: any;
    ipAddress?: string;
  }) {
    const log = this.auditRepository.create(entry);
    await this.auditRepository.save(log);
  }

  async getActivityLog(tenantId: string, filters: any) {
    return this.auditRepository.find({
      where: { tenantId, ...filters },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
}

// Decorator for automatic audit logging
export function AuditLog(action: string, resource: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const result = await originalMethod.apply(this, args);
      
      // Log the action
      const auditService = this.auditService;
      const user = this.request.user;
      
      await auditService.log({
        userId: user.id,
        tenantId: user.tenantId,
        action,
        resource,
        resourceId: result?.id,
      });

      return result;
    };

    return descriptor;
  };
}
```

---

## Güvenlik Gereksinimleri

### 1. Authentication & Authorization
- ✅ JWT tokens (short-lived access, long-lived refresh)
- ✅ Password hashing (bcrypt)
- ✅ Role-based access control (RBAC)
- ✅ Two-factor authentication (2FA) - İsteğe bağlı
- ✅ Rate limiting (brute force protection)

### 2. Data Security
- ✅ Row-level security (tenant isolation)
- ✅ Encrypted connections (HTTPS/TLS)
- ✅ Database encryption at rest
- ✅ Sensitive data encryption (field-level)
- ✅ Regular backups

### 3. API Security
- ✅ CORS configuration
- ✅ Helmet.js (security headers)
- ✅ Request validation (class-validator)
- ✅ SQL injection protection (ORM)
- ✅ XSS protection
- ✅ CSRF tokens

### 4. Monitoring & Logging
- ✅ Error tracking (Sentry)
- ✅ Performance monitoring (New Relic/Datadog)
- ✅ Audit logs
- ✅ Access logs

---

## Veritabanı Şeması

```sql
-- Core Tables
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  subscription_plan VARCHAR(50) DEFAULT 'free',
  subscription_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  settings JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role VARCHAR(50) DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  address TEXT,
  tax_number VARCHAR(50),
  company VARCHAR(255),
  balance DECIMAL(15, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  invoice_number VARCHAR(50) NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_amount DECIMAL(15, 2) DEFAULT 0,
  total DECIMAL(15, 2) NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(tenant_id, invoice_number)
);

CREATE TABLE invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  total DECIMAL(15, 2) NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_customer ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_dates ON invoices(issue_date, due_date);

-- Audit log table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(100) NOT NULL,
  resource_id UUID,
  changes JSONB,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
```

---

## Teknoloji Yığını

### Backend
- **Framework**: NestJS (Node.js + TypeScript)
- **Database**: PostgreSQL 15
- **ORM**: TypeORM
- **Cache**: Redis
- **Authentication**: JWT + Passport
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **File Storage**: AWS S3 / Cloudinary
- **Payment**: Stripe
- **Email**: SendGrid / AWS SES
- **Real-time**: Socket.IO

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **State Management**: Zustand
- **Data Fetching**: React Query (TanStack Query)
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod
- **UI**: Tailwind CSS + Headless UI
- **Icons**: Lucide React
- **Charts**: Recharts
- **PDF**: jsPDF + html2canvas
- **Excel**: ExcelJS

### DevOps
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Hosting**: 
  - Backend: AWS EC2 / DigitalOcean / Render
  - Frontend: Vercel / Netlify
  - Database: AWS RDS / DigitalOcean Managed DB
- **Monitoring**: Sentry, Datadog
- **CDN**: Cloudflare

---

## Zaman Çizelgesi

### Sprint 1-2: Backend Altyapısı (2 hafta)
- [x] NestJS projesi kurulumu
- [ ] PostgreSQL + Docker Compose
- [ ] Authentication module (JWT)
- [ ] User & Tenant models
- [ ] Basic CRUD endpoints

### Sprint 3-4: Multi-Tenancy (2 hafta)
- [ ] Tenant middleware
- [ ] Row-level security
- [ ] Database migrations
- [ ] Seed data
- [ ] API documentation (Swagger)

### Sprint 5-6: Business Logic (2 hafta)
- [ ] Customers module
- [ ] Invoices module
- [ ] Expenses module
- [ ] Sales module
- [ ] Reports module

### Sprint 7-8: Frontend Integration (2 hafta)
- [ ] API client setup
- [ ] React Query integration
- [ ] Auth flow (login/register)
- [ ] Protected routes
- [ ] State management

### Sprint 9-10: Core Features (2 hafta)
- [ ] Customers page
- [ ] Invoices page
- [ ] Expenses page
- [ ] Dashboard with real data
- [ ] PDF generation (backend)

### Sprint 11-12: Advanced Features (2 hafta)
- [ ] Real-time updates (WebSocket)
- [ ] File uploads
- [ ] Excel import/export
- [ ] Email notifications
- [ ] Audit logging

### Sprint 13-14: Subscription & Billing (2 hafta)
- [ ] Stripe integration
- [ ] Subscription plans
- [ ] Payment webhooks
- [ ] Billing page
- [ ] Plan limits enforcement

### Sprint 15-16: Testing & Deployment (2 hafta)
- [ ] Unit tests (>80% coverage)
- [ ] E2E tests
- [ ] Performance optimization
- [ ] Security audit
- [ ] Production deployment

**Toplam Süre: 16 hafta (4 ay)**

---

## Maliyet Tahmini

### Geliştirme Maliyeti
- Backend Developer: 4 ay × ₺50,000 = ₺200,000
- Frontend Developer: 4 ay × ₺45,000 = ₺180,000
- DevOps: 2 ay × ₺40,000 = ₺80,000
- **Toplam**: ₺460,000

### Aylık Operasyonel Maliyet (İlk 100 kullanıcı)
- AWS/DigitalOcean: ₺2,000
- Database: ₺1,500
- Redis: ₺500
- S3 Storage: ₺300
- Email (SendGrid): ₺200
- Monitoring (Sentry): ₺500
- Domain + SSL: ₺100
- **Toplam**: ₺5,100/ay

---

## Sonraki Adımlar

### Hemen Başlayabileceğiniz
1. ✅ Backend repo oluştur
2. ✅ NestJS projesi kur
3. ✅ Docker Compose ile PostgreSQL başlat
4. ✅ Authentication modülü geliştir
5. ✅ İlk API endpoint'leri yaz

### Bu Hafta
```bash
# 1. Backend klasörü oluştur
mkdir ../backend
cd ../backend

# 2. NestJS CLI kur
npm i -g @nestjs/cli

# 3. Yeni proje
nest new moneyflow-api

# 4. İlk modül
nest g module auth
nest g service auth
nest g controller auth
```

**Başlamak için yardıma ihtiyacınız varsa ben buradayım! 🚀**
