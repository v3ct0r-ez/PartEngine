import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_ORIGIN?.split(',') ?? true, credentials: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const config = new DocumentBuilder()
    .setTitle('PartEngine API')
    .setDescription('Enterprise WMS for electronic components')
    .setVersion('0.0.1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.API_PORT ?? 4000);
  // HOST controls local-only (127.0.0.1) vs LAN (0.0.0.0) in the desktop build.
  const host = process.env.HOST ?? '0.0.0.0';

  // The Next.js server proxies /api here and pools keep-alive connections. Node's
  // default keepAliveTimeout (5s) makes the API close idle sockets that Next is
  // still holding; reusing a just-closed socket surfaces on Windows as ETIMEDOUT
  // (not a clean retry), which Next then returns to the browser as a 500. Keeping
  // the API's keep-alive window well above the proxy's idle reuse window removes
  // the race. headersTimeout must stay greater than keepAliveTimeout.
  const server = app.getHttpServer();
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(`PartEngine API listening on ${host}:${port}`);
}

bootstrap();
