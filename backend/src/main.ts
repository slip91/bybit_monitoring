import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { WINSTON_MODULE_NEST_PROVIDER } from "nest-winston";

import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  
  // Winston logger для структурированного логирования
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);
  
  // Глобальная обработка ошибок с логированием
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  
  // Логирование всех HTTP запросов
  app.useGlobalInterceptors(new LoggingInterceptor(logger));
  
  // Автоматическая валидация входящих данных
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Удаляет неизвестные поля
      forbidNonWhitelisted: true, // Отклоняет запросы с лишними полями
      transform: true, // Преобразует типы автоматически
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );
  
  // Swagger документация API
  const config = new DocumentBuilder()
    .setTitle('Bybit Bots API')
    .setDescription('API для управления и мониторинга торговых ботов Bybit')
    .setVersion('1.0')
    .addTag('bots', 'Bot management endpoints')
    .addTag('dashboard', 'Dashboard and analytics')
    .addTag('alerts', 'Alert management')
    .addTag('plan', 'Trading plan management')
    .addTag('health', 'Health check endpoints')
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  
  const host = process.env.BOT_API_HOST || "127.0.0.1";
  const port = Number(process.env.BOT_API_PORT || 3100);

  await app.listen(port, host);
  logger.log(`Nest API listening on http://${host}:${port}`, 'Bootstrap');
  logger.log(`Swagger docs available at http://${host}:${port}/api/docs`, 'Bootstrap');
}

void bootstrap();
