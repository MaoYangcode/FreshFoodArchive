import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveRequestUserId } from './common/user-context';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id'],
  })
  app.use((req: any, _res: any, next: any) => {
    req.userId = resolveRequestUserId(req)
    next()
  })
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0');
}
bootstrap();
