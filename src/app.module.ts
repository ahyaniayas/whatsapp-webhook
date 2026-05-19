import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { ConfigKyselyModule } from './config/modules/config.kysely.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ConfigKyselyModule,
    WhatsappModule,
  ],
})
export class AppModule { }