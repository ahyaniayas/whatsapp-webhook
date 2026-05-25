import {
    HttpException,
    Injectable,
    Logger,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class WaApiService {
    private readonly logger = new Logger(
        WaApiService.name,
    );

    private readonly waApiBaseUrl = process.env.WA_API_BASE_URL;
    private readonly waApiVersion = process.env.WA_API_VERSION;
    private readonly waPhoneNumberId = process.env.WA_PHONE_NUMBER_ID;
    private readonly waToken = process.env.WA_TOKEN;
    private readonly waTemplateSlipGaji = 'slip_gaji_notification';

    constructor(
        private readonly httpService: HttpService,
        private readonly loggerService: LoggerService,
    ) { }

    async sendSlipGaji(data: {
        phone: string;
        nik: string;
        nama: string;
        periode: string;
        file: Express.Multer.File;
    }) {
        let mediaId: string | null = null;

        try {
            // 1 upload media
            mediaId =
                await this.uploadMedia(
                    data.file,
                );

            // 2 send template
            const response =
                await this.sendTemplate({
                    to: data.phone,
                    mediaId,
                    nama: data.nama,
                    nik: data.nik,
                    periode: data.periode,
                });

            const waMessageId =
                response?.data?.messages?.[0]
                    ?.id;

            // success log
            await this.loggerService.insertWebhookLog({
                webhook_object: 'whatsapp_business_account',
                webhook_field: 'messages',
                wa_message_id: waMessageId,
                to_number: data.phone,
                message_type: 'template',
                message_status: 'requested',
                media_id: mediaId,
                media_filename: data.file.originalname,
                media_mime_type: data.file.mimetype,
                message_text: `Slip Gaji ${data.periode}`,
                raw_json: JSON.stringify(response.data),
            });

            return {
                success: true,
                mediaId,
                response:
                    response.data,
            };
        } catch (err: any) {
            this.logger.error(err);

            // failed log
            await this.loggerService.insertWebhookLog({
                webhook_object: 'whatsapp_business_account',
                webhook_field: 'messages',
                to_number: data.phone,
                message_type: 'template',
                message_status: 'failed',
                media_id: mediaId,
                media_filename: data.file.originalname,
                media_mime_type: data.file.mimetype,
                message_text: `Slip Gaji ${data.periode}`,
                error_code: err?.response?.data?.error?.code,
                error_message: err?.response?.data?.error?.message || err?.message,
                raw_json: JSON.stringify(err?.response?.data || err),
            });

            throw new HttpException(err?.response?.data || 'Failed send whatsapp', err?.response?.status || 500);
        }
    }

    private async uploadMedia(
        file: Express.Multer.File,
    ): Promise<string> {
        const form = new FormData();

        form.append(
            'messaging_product',
            'whatsapp',
        );

        form.append(
            'file',
            file.buffer,
            {
                filename: file.originalname,
                contentType: file.mimetype,
            },
        );

        const response = await firstValueFrom(
            this.httpService.post(
                `${this.waApiBaseUrl}/${this.waApiVersion}/${this.waPhoneNumberId}/media`,
                form,
                {
                    headers: {
                        Authorization: `Bearer ${this.waToken}`,
                        ...form.getHeaders(),
                    },
                },
            ),
        );

        return response.data.id;
    }

    private async sendTemplate(data: {
        to: string;
        mediaId: string;
        nama: string;
        nik: string;
        periode: string;
    }) {
        return firstValueFrom(
            this.httpService.post(
                `${this.waApiBaseUrl}/${this.waApiVersion}/${this.waPhoneNumberId}/messages`,
                {
                    messaging_product: 'whatsapp',
                    to: data.to,
                    type: 'template',
                    template: {
                        name: this.waTemplateSlipGaji,
                        language: {
                            code: 'id',
                        },
                        components: [
                            {
                                type: 'header',
                                parameters: [
                                    {
                                        type: 'document',
                                        document: {
                                            id: data.mediaId,
                                            filename: `Slip-Gaji-${data.periode}.pdf`,
                                        },
                                    },
                                ],
                            },
                            {
                                type: 'body',
                                parameters: [
                                    {
                                        type: 'text',
                                        text: data.nama,
                                    },
                                    {
                                        type: 'text',
                                        text: data.nik,
                                    },
                                    {
                                        type: 'text',
                                        text: data.periode,
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.waToken}`,
                        'Content-Type': 'application/json',
                    },
                },
            ),
        );
    }
}
