import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SeedService } from './database/seed.service';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';

async function bootstrap() {
  const isProd = process.env.NODE_ENV === 'production';
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: isProd
      ? ['error', 'warn', 'log']
      : ['error', 'warn', 'log', 'debug', 'verbose'],
    // Nest'in varsayılan body-parser'ını devre dışı bırakıyoruz; kendi limitlerimizi uygulayacağız
    bodyParser: false,
  });

  // Increase body size limits to support base64-encoded logos and larger payloads
  // Not: Base64 veri gerçek dosyadan ~%33 daha büyük olur; 10mb güvenli sınır.
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // Body parser kaynaklı "PayloadTooLargeError" hatasını 413 olarak döndür
  // (aksi halde GlobalExceptionFilter altında 500'e dönüşebiliyor)
  app.use((err: any, _req: any, res: any, next: any) => {
    if (err && (err.type === 'entity.too.large' || err.name === 'PayloadTooLargeError')) {
      return res.status(413).json({
        statusCode: 413,
        error: 'Payload Too Large',
        message:
          'Gönderilen veri çok büyük. Lütfen 5MB altında bir logo veya daha küçük bir veri yükleyin.',
      });
    }
    return next(err);
  });

  // Güvenlik headers
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
      crossOriginEmbedderPolicy: false, // API için gerekli
    }),
  );

  // Cookie parser for secure cookie handling
  app.use(cookieParser());

  // HTTP response compression (gzip/deflate)
  app.use(
    compression({
      threshold: 1024, // 1KB ve üzerini sıkıştır
    }),
  );

  // Seed database if empty
  const seedService = app.get(SeedService);
  await seedService.seed();

  // Serve static files from public
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false, // Don't serve index.html automatically
    prefix: '/',
    maxAge: '7d', // statik dosyaları 7 gün cachele
    setHeaders: (res, path) => {
      if (/\.(?:js|css|svg|png|jpg|jpeg|gif|woff2?)$/i.test(path)) {
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
      }
    },
  });

  // Gelişmiş CORS yapılandırması - Codespaces ve prod için güvenli
  const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        // Curl veya same-origin istekler
        return callback(null, true);
      }
      if (!isProd) {
        // Development: tüm originlere izin ver, ancak logu azalt
        return callback(null, true);
      }
      // Production: allowlist kontrolü
      const ok = allowedOrigins.includes(origin);
      if (ok) return callback(null, true);
      return callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true, // Secure cookies için gerekli
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Origin',
      'X-Requested-With',
      'X-CSRF-Token',
    ],
    exposedHeaders: ['Authorization', 'X-CSRF-Token'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Secure cookie configuration
  app.use((req, res, next) => {
    // Override cookie method for secure settings
    const originalCookie = res.cookie;
    res.cookie = function (name, value, options = {}) {
      const secureOptions = {
        httpOnly: true, // XSS koruması
        secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
        sameSite:
          process.env.NODE_ENV === 'production' ? 'strict' : ('lax' as const),
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        ...options,
      };
      return originalCookie.call(this, name, value, secureOptions);
    };
    next();
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('MoneyFlow API')
    .setDescription('Multi-tenant accounting and finance management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Global API prefix (development de de prod ile aynı olsun)
  app.setGlobalPrefix('api', { exclude: ['health'] });

  SwaggerModule.setup('api/docs', app, document);

  // Port seçimi: Production'da 3000, diğer tüm ortamlarda (development, test, undefined) 3001 kullan.
  const defaultPort = process.env.NODE_ENV === 'production' ? '3000' : '3001';
  const port = parseInt(process.env.PORT || defaultPort, 10);
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
