import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { LoggerModule } from 'src/logger/logger.module';

@Module({
    imports: [LoggerModule],
    controllers: [WhatsappController],
    providers: [WhatsappService],
})
export class WhatsappModule { }