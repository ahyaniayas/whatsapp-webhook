import { Module } from '@nestjs/common';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { WaApiModule } from 'src/api/v1/wa-api/wa-api.module';

@Module({
    imports: [WaApiModule],
    controllers: [MfaController],
    providers: [MfaService],
    exports: [MfaService],
})
export class MfaModule {}
