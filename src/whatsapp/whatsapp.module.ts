import { Module } from '@nestjs/common';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';
import { LoggerModule } from 'src/logger/logger.module';
import { MfaModule } from 'src/mfa/mfa.module';

@Module({
    imports: [LoggerModule, MfaModule],
    controllers: [WhatsappController],
    providers: [WhatsappService],
})
export class WhatsappModule { }