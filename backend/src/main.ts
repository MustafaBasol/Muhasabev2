import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Serve static files from public
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    index: false, // Don't serve index.html automatically
    prefix: '/',
  });
  
  // Gelişmiş CORS yapılandırması
  app.enableCors({
    origin: (origin, callback) => {
      // Tüm localhost originlerine izin ver
      const allowedOrigins = [
        'http://localhost:5173',
        'http://localhost:3002',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:3002',
      ];
      
      if (!origin || allowedOrigins.includes(origin) || origin.includes('github.dev')) {
        callback(null, true);
      } else {
        callback(null, true); // Development'ta tüm originlere izin ver
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
    exposedHeaders: ['Authorization'],
    maxAge: 3600,
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('MoneyFlow API')
    .setDescription('Multi-tenant accounting and finance management API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  const port = 3002; // Fixed port to avoid conflicts
  const host = '0.0.0.0';
  await app.listen(port, host);

  const codespaceName = process.env.CODESPACE_NAME;
  const externalUrl = codespaceName
    ? `https://${codespaceName}-${port}.app.github.dev`
    : `http://localhost:${port}`;

  console.log(`🚀 Application is running on: ${externalUrl}`);
  console.log(`📚 Swagger documentation: ${externalUrl}/api`);
}
bootstrap();
