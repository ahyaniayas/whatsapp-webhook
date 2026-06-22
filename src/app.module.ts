import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConfigKyselyModule } from './config/modules/config.kysely.module';
import { WaApiModule } from './api/v1/wa-api/wa-api.module';
import { LoggerModule } from './logger/logger.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AppKeyModule } from './app-key/app-key.module';
import { AccessLogMiddleware } from './common/access-log.middleware';
import { AccessLogModule } from './access-log/access-log.module';

const isSchedulerEnabled = process.env.WA_SCHEDULER === 'true';
const schedulerModules = isSchedulerEnabled ? [ScheduleModule.forRoot()] : [];

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ...schedulerModules,
    ConfigKyselyModule,
    AuthModule,
    DashboardModule,
    AppKeyModule,
    AccessLogModule,
    WhatsappModule,
    WaApiModule,
    LoggerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessLogMiddleware).forRoutes('*');
  }
}
