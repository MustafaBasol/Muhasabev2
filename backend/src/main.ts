import { NestFactory } from '@nestjs/core';
import { json, urlencoded, raw } from 'express';
import type {
  Request,
  Response,
  ErrorRequestHandler,
  RequestHandler,
  CookieOptions,
} from 'express';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SeedService } from './database/seed.service';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import type { CompressionOptions } from 'compression';
import { randomBytes } from 'crypto';
import { existsSync, mkdirSync } from 'fs';

type ResponseWithLocals = Response & { locals: Record<string, unknown> };
type BodyParserError = Error & { type?: string };
type OriginCallback = (err: Error | null, allow?: boolean) => void;

const isPayloadTooLargeError = (error: unknown): error is BodyParserError => {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as BodyParserError;
  return (
    candidate.type === 'entity.too.large' ||
    candidate.name === 'PayloadTooLargeError'
  );
};

const payloadTooLargeHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (isPayloadTooLargeError(err)) {
    res.status(413).json({
      statusCode: 413,
      error: 'Payload Too Large',
      message:
        'Gönderilen veri çok büyük. Lütfen 5MB altında bir logo veya daha küçük bir veri yükleyin.',
    });
    return;
  }
  next(err);
};

const attachLocal = (res: Response, key: string, value: unknown) => {
  const target = res as ResponseWithLocals;
  const current = target.locals ?? {};
  target.locals = { ...current, [key]: value };
};

const bindCookie = (res: Response): typeof res.cookie =>
  res.cookie.bind(res) as typeof res.cookie;

const toSafeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

const toRequestHandler = (middleware: unknown): RequestHandler => {
  if (typeof middleware !== 'function') {
    throw new TypeError('Express middleware must be a function');
  }
  return middleware as RequestHandler;
};

type RequestHandlerFactory<TArgs extends unknown[] = []> = (
  ...args: TArgs
) => RequestHandler;

const cookieParserFactory = cookieParser as RequestHandlerFactory;
const compressionFactory = compression as RequestHandlerFactory<
  [CompressionOptions?]
>;

const cspNonceMiddleware: RequestHandler = (_req, res, next) => {
  const nonce = randomBytes(16).toString('base64');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-${nonce}'; img-src 'self' data: https:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-src 'none'`,
  );
  attachLocal(res, 'cspNonce', nonce);
  next();
};

const secureCookieMiddleware: RequestHandler = (_req, res, next) => {
  const originalCookie: typeof res.cookie = bindCookie(res);
  const secureCookie: typeof res.cookie = (
    name: Parameters<typeof res.cookie>[0],
    value: Parameters<typeof res.cookie>[1],
    options?: CookieOptions,
  ) => {
    const secureOptions: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite:
        process.env.NODE_ENV === 'production' ? ('strict' as const) : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/',
      ...options,
    };
    return originalCookie(name, value, secureOptions);
  };
  res.cookie = secureCookie;
  next();
};

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'], // Nest'in varsayılan body-parser'ını devre dışı bırakıyoruz; kendi limitlerimizi uygulayacağız
    bodyParser: false,
  }); // Stripe webhook için raw body gerekiyor; bunu body parser'lardan ÖNCE ekleyin

  app.use('/api/webhooks/stripe', raw({ type: '*/*' })); // Increase body size limits to support base64-encoded logos and larger payloads
  // Not: Base64 veri gerçek dosyadan ~%33 daha büyük olur; 10mb güvenli sınır.

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' })); // Body parser kaynaklı "PayloadTooLargeError" hatasını 413 olarak döndür
  // (aksi halde GlobalExceptionFilter altında 500'e dönüşebiliyor)

  app.use(payloadTooLargeHandler); // Güvenlik headers

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      hsts: isProd
        ? { maxAge: 15552000, includeSubDomains: true, preload: false }
        : false,
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'no-referrer' },
      crossOriginEmbedderPolicy: false, // API için gerekli
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  ); // Cookie parser for secure cookie handling

  const cookieParserMiddleware = toRequestHandler(cookieParserFactory());
  app.use(cookieParserMiddleware); // Opsiyonel: CSP nonce üretimi (SECURITY_ENABLE_CSP_NONCE=true ise)

  if (String(process.env.SECURITY_ENABLE_CSP_NONCE).toLowerCase() === 'true') {
    app.use(cspNonceMiddleware);
  } // HTTP response compression (gzip/deflate)

  const compressionMiddleware = toRequestHandler(
    compressionFactory({
      threshold: 1024, // 1KB ve üzerini sıkıştır
    }),
  );
  app.use(compressionMiddleware);

  // Migrations are intentionally opt-in at boot.
  // Production deploys should run migrations explicitly before restart.
  if (process.env.DB_MIGRATIONS_RUN === 'true') {
    if (!isProd) {
      console.log('⚙️  Migration kontrolü (development)...');
    } else {
      console.log('⚙️  Migration kontrolü (production)...');
    }

    try {
      const dataSource: DataSource = app.get(DataSource);
      if (!dataSource.isInitialized) {
        await dataSource.initialize();
      }

      const pendingMigrations = await dataSource.showMigrations();
      if (pendingMigrations) {
        console.log('🚀 Pending migration(lar) bulundu. Çalıştırılıyor...');
        await dataSource.runMigrations();
        console.log('✅ Migration(lar) başarıyla uygulandı.');
      } else {
        console.log('✅ Uygulanacak migration yok.');
      }
    } catch (err: unknown) {
      const safeError = toSafeError(err);
      console.error('❌ Migration çalıştırma hatası:', safeError);

      if (isProd) {
        throw safeError;
      } else {
        console.warn(
          '⚠️ Development ortamında migration hatası yutuldu. Devam ediliyor.',
        );
      }
    }
  } else {
    console.log('ℹ️  Boot-time migrations disabled. Set DB_MIGRATIONS_RUN=true to enable.');
  }

  // Seed database if empty (migrationlardan sonra)

  const seedService = app.get(SeedService);
  await seedService.seed(); // Serve static files from public

  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false, // Don't serve index.html automatically
    prefix: '/',
    maxAge: '7d', // statik dosyaları 7 gün cachele
    setHeaders: (res: Response, filePath: string) => {
      if (/\.(?:js|css|svg|png|jpg|jpeg|gif|woff2?)$/i.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
    },
  }); // Gelişmiş CORS yapılandırması - Codespaces ve prod için güvenli

  // SPA deep-link fallback (ör: /public/quote/:id)
  // Not: Static middleware bir dosya bulamazsa next() ile devam eder; burada index.html'e düşürüyoruz.
  const spaIndexCandidates = [
    join(process.cwd(), 'public', 'dist', 'index.html'),
    join(__dirname, '..', 'public', 'dist', 'index.html'),
    join(process.cwd(), 'public', 'index.html'),
    join(__dirname, '..', 'public', 'index.html'),
  ];
  const spaIndexPath = spaIndexCandidates.find((candidate) =>
    existsSync(candidate),
  );
  if (!spaIndexPath) {
    console.warn(
      '⚠️ SPA index.html bulunamadı; deep-link route’lar 404 dönebilir.',
      {
        candidates: spaIndexCandidates,
      },
    );
  } else {
    app.use((req: Request, res: Response, next) => {
      if (req.method !== 'GET') return next();

      const path = req.path || req.url || '';

      // API ve swagger gibi backend route'larını bozma
      if (path.startsWith('/api')) return next();

      // Statik asset isteklerini bozma
      if (path.startsWith('/assets')) return next();

      // SEO blog sayfalarını bozma
      if (path === '/blog' || path.startsWith('/blog/')) return next();

      // Statik dosya isteklerini (uzantılı) bozma
      if (path.includes('.')) return next();

      return res.sendFile(spaIndexPath, (err) => {
        if (err) return next(err);
      });
    });
  }

  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const corsOriginHandler = (
    origin: string | undefined,
    callback: OriginCallback,
  ): void => {
    if (!origin) {
      // Curl veya same-origin istekler
      return callback(null, true);
    }
    if (!isProd) {
      // Development: tüm originlere izin ver, ancak logu azalt
      return callback(null, true);
    } // Production: allowlist kontrolü
    const ok = allowedOrigins.includes(origin);
    if (ok) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };

  const corsOptions: CorsOptions = {
    origin: corsOriginHandler,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true, // Secure cookies için gerekli
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-CSRF-Token',
      'admin-token',
      'Admin-Token',
    ],
    exposedHeaders: ['Authorization', 'X-CSRF-Token'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  };

  app.enableCors(corsOptions); // Secure cookie configuration

  app.use(secureCookieMiddleware); // Global validation pipe

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  ); // Global exception filter

  app.useGlobalFilters(new GlobalExceptionFilter()); // Global logging interceptor

  app.useGlobalInterceptors(new LoggingInterceptor()); // Swagger setup

  const config = new DocumentBuilder()
    .setTitle('Comptario API')
    .setDescription('Multi-tenant accounting and finance management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // KESİN ÇÖZÜM: Tüm istekleri yakalayıp /admin/login olanları /api/admin/login'e yönlendiriyoruz
  // Bu, frontend'in yanlış adres isteğini düzeltir
  app.use((req, res, next) => {
    // req.url, /admin/login?query gibi gelecektir.
    // Eğer /api/ ile başlamıyorsa VE /admin/login ile başlıyorsa, /api ön ekini ekle
    if (!req.url.startsWith('/api') && req.url.startsWith('/admin/login')) {
      req.url = `/api${req.url}`;
    }
    next();
  });

  app.setGlobalPrefix('api');

  SwaggerModule.setup('api/docs', app, document);

  // Port seçimi: Production'da 3000, diğer tüm ortamlarda (development, test, undefined) 3001 kullan.
  const defaultPort =
    process.env.PORT ||
    (process.env.NODE_ENV === 'production' ? '3000' : '3001');
  const port = parseInt(defaultPort, 10);
  if (!process.env.PORT) {
    console.log(
      `ℹ️ PORT env tanımlı değil; NODE_ENV='${process.env.NODE_ENV ?? ''}' için varsayılan port ${port} seçildi. Çakışma varsa PORT değişkeni ile özelleştirin.`,
    );
  } else {
    console.log(
      `ℹ️ PORT env tanımlı: ${process.env.PORT}. NODE_ENV='${process.env.NODE_ENV ?? ''}'. Dinlenecek port: ${port}.`,
    );
  }
  const host = '0.0.0.0'; // Bu tüm interface'lerde dinlemeyi sağlar

  await app.listen(port, host);

  const codespaceName = process.env.CODESPACE_NAME;
  const externalUrl = codespaceName
    ? `https://${codespaceName}-${port}.app.github.dev`
    : `http://localhost:${port}`;

  console.log(`🚀 Application is running on: ${externalUrl}`);
  console.log(`📚 Swagger documentation: ${externalUrl}/api`);
  console.log(`🔗 Local access: http://localhost:${port}`);
}
// Top-level bootstrap; explicitly ignore returned Promise to avoid floating-promises warning
void bootstrap();
