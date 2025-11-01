import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { SeedService } from './database/seed.service';
import helmet from 'helmet';
// import * as cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Güvenlik headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // API için gerekli
  }));

  // Cookie parser for secure cookie handling
  // app.use(cookieParser()); // Uncomment when cookie-parser is installed

  // Seed database if empty
  const seedService = app.get(SeedService);
  await seedService.seed();

  // Serve static files from public
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false, // Don't serve index.html automatically
    prefix: '/',
  });
  
  // Gelişmiş CORS yapılandırması - GitHub Codespaces için
  app.enableCors({
    origin: (origin, callback) => {
      // Development: tüm originlere izin ver
      console.log('🌐 CORS Request from origin:', origin);
      callback(null, true);
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true, // Secure cookies için gerekli
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-CSRF-Token'],
    exposedHeaders: ['Authorization', 'X-CSRF-Token'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Secure cookie configuration
  app.use((req, res, next) => {
    // Override cookie method for secure settings
    const originalCookie = res.cookie;
    res.cookie = function(name, value, options = {}) {
      const secureOptions = {
        httpOnly: true, // XSS koruması
        secure: process.env.NODE_ENV === 'production', // HTTPS-only in production
        sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax' as const,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/',
        ...options
      };
      return originalCookie.call(this, name, value, secureOptions);
    };
    next();
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

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

  const port = parseInt(process.env.PORT || '3000', 10);
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
bootstrap();
