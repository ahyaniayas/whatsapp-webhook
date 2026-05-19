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
        // const verifyToken = this.configService.get<string>(
        //     'WHATSAPP_VERIFY_TOKEN',
        // );

        console.log("START:GET::HASIL:", mode, token, challenge);
        console.log("END:GET::HASIL");
        // if (mode === 'subscribe' && token === verifyToken) {
        if (mode === 'subscribe') {
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
        // optional signature validation
        // this.validateSignature(signature, body);

        console.log("START:POST::HASIL:", signature, body);
        // ambil statuses
        const statuses =
            body?.entry?.[0]?.changes?.[0]?.value?.statuses;

        if (statuses?.length) {
            for (const status of statuses) {
                console.log(
                    'STATUS DETAIL::',
                    JSON.stringify(status),
                );

                // tampilkan error jika ada
                if (status?.errors?.length) {
                    console.log(
                        'ERROR DETAIL::',
                        JSON.stringify(status.errors),
                    );
                }
            }
        }
        console.log("END:POST::HASIL");

        await this.whatsappService.handleWebhook(body);

        return {
            success: true,
        };
    }

    private validateSignature(signature: string, body: any) {
        try {
            const appSecret =
                this.configService.get<string>('WHATSAPP_APP_SECRET');

            if (!appSecret || !signature) {
                return true;
            }

            const expectedSignature =
                'sha256=' +
                createHmac('sha256', appSecret)
                    .update(JSON.stringify(body))
                    .digest('hex');

            const isValid = timingSafeEqual(
                Buffer.from(signature),
                Buffer.from(expectedSignature),
            );

            if (!isValid) {
                this.logger.warn('Invalid webhook signature');
            }

            return isValid;
        } catch (err) {
            this.logger.error(err);

            return false;
        }
    }
}