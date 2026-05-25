import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConfigKyselyModule } from './config/modules/config.kysely.module';
import { WaApiModule } from './api/v1/wa-api/wa-api.module';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigKyselyModule,
    WhatsappModule,
    WaApiModule,
    LoggerModule,
  ],
})
export class AppModule { }