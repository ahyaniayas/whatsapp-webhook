import { Module } from '@nestjs/common';
import { AppKeyService } from './app-key.service';
import { AppKeyController } from './app-key.controller';

@Module({
    controllers: [AppKeyController],
    providers: [AppKeyService],
})
export class AppKeyModule {}
