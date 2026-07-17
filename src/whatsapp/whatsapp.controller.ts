import {
    Body,
    Controller,
    Get,
    Headers,
    HttpCode,
    Logger,
    Post,
    Query,
    Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { WhatsappService } from './whatsapp.service';

@Controller('webhook/whatsapp')
export class WhatsappController {
    private readonly verifyToken = process.env.WEBHOOK_TOKEN;
    private readonly logger = new Logger(WhatsappController.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly whatsappService: WhatsappService,
    ) { }

    @Get()
    verifyWebhook(
        @Query('hub.mode') mode: string,
        @Query('hub.verify_token') token: string,
        @Query('hub.challenge') challenge: string,
        @Res() res: Response,
    ) {
        console.log("START:GET::HASIL:");
        console.log(mode, token, challenge);
        console.log("END:GET::HASIL");

        if (mode === 'subscribe' && token === this.verifyToken) {
            this.logger.log('Webhook verified');

            return res.status(200).send(challenge);
        }

        return res.sendStatus(403);
    }

    @Post()
    @HttpCode(200)
    async receiveWebhook(
        @Body() body: any,
        @Headers('x-hub-signature-256') signature: string,
    ) {
        console.log("START:POST::HASIL:");
        console.log(signature, JSON.stringify(body));
        console.log("END:POST::HASIL");

        await this.whatsappService.handleWebhook(body);

        return {
            success: true,
        };
    }
}
