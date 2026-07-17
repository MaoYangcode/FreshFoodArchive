import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { resolveRequestUserId } from './common/user-context';
import { json, urlencoded } from 'express';
import { UnauthorizedException } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: '10mb' }))
  app.use(urlencoded({ extended: true, limit: '10mb' }))
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
  app.use((req: any, _res: any, next: any) => {
    if (`${req?.method || ''}`.toUpperCase() === 'OPTIONS') {
      next()
      return
    }
    const path = `${req?.path || req?.url || ''}`
    const isPublicPath = path === '/' || path === '/iconfont.ttf' || path.startsWith('/nutrition-icons/') || path === '/auth/wechat-login'
    if (isPublicPath) {
      next()
      return
    }
    const userId = resolveRequestUserId(req)
    if (!userId) {
      next(new UnauthorizedException('请先完成微信登录'))
      return
    }
    req.userId = userId
    next()
  })
  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port, '0.0.0.0');
}
bootstrap();
