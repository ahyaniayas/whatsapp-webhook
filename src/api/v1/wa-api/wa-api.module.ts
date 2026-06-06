import { Module } from '@nestjs/common';
import { WaApiController } from './wa-api.controller';
import { WaApiService } from './wa-api.service';
import { HttpModule } from '@nestjs/axios';
import { LoggerModule } from 'src/logger/logger.module';
import { WaApiProcessorService } from './wa-api-processor.service';
@Module({
    imports: [HttpModule, LoggerModule],
    controllers: [WaApiController],
    providers: [WaApiService, WaApiProcessorService],
    exports: [WaApiService],
})
export class WaApiModule { }
