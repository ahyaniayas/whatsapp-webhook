import {
    Body,
    Controller,
    Headers,
    Post,
    UnauthorizedException,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WaApiService } from './wa-api.service';
import { memoryStorage } from 'multer';

@Controller('api/v1/wa-api')
export class WaApiController {
    private readonly apiKey = process.env.API_KEY;

    constructor(
        private readonly waApiService: WaApiService,
    ) { }

    @Post('send-slip-gaji')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), }))
    async sendSlipGaji(
        @Headers('api-key') hApiKey: string,
        @UploadedFile() file: Express.Multer.File,
        @Body('phone') phone: string,
        @Body('nik') nik: string,
        @Body('nama') nama: string,
        @Body('periode') periode: string,
    ) {
        if (hApiKey !== this.apiKey) {
            throw new UnauthorizedException('Invalid API Key');
        }

        return this.waApiService.sendSlipGaji({
            phone,
            nik,
            nama,
            periode,
            file,
        });
    }
}
