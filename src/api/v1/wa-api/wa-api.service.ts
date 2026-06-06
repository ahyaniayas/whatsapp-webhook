// src/wa-api/wa-api.service.ts
import {
    HttpException,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import { LoggerService } from 'src/logger/logger.service';
import { Kysely } from 'kysely';

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

    @Inject('KYSELY_CONNECTION')
    private readonly db: Kysely<any>;
    private readonly tableQue = 'que.q01_slip_gaji';

    constructor(
        private readonly httpService: HttpService,
        private readonly loggerService: LoggerService,
    ) { }

    async createQueue(data: {
        phone: string;
        nik: string;
        nama: string;
        periode: string;
        file: Express.Multer.File;
    }) {
        return await this.db
            .insertInto(this.tableQue)
            .values({
                phone: data.phone,
                nik: data.nik,
                nama: data.nama,
                periode: data.periode,
                file_name: data.file.originalname,
                file_mime: data.file.mimetype,
                file_base64: data.file.buffer.toString('base64'),
                status: 'WAITING',
            })
            .execute();
    }

    // Ditambahkan parameter queueId untuk mengunci data secara spesifik
    async sendSlipGaji(data: {
        queueId: string;
        phone: string;
        nik: string;
        nama: string;
        periode: string;
        file: Express.Multer.File;
    }) {
        let mediaId: string | null = null;

        try {
            // 1. Upload media ke Meta Server
            mediaId = await this.uploadMedia(data.file);

            // 2. Kirim template menggunakan mediaId
            const response = await this.sendTemplate({
                to: data.phone,
                mediaId,
                nama: data.nama,
                nik: data.nik,
                periode: data.periode,
            });

            const waMessageId = response?.data?.messages?.[0]?.id;

            // 3. Success log ke audit table system Anda
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

            // 4. Update status antrean menjadi SUCCESS langsung di sini
            await this.db
                .updateTable(this.tableQue)
                .set({
                    status: 'SUCCESS',
                    updated_at: new Date()
                })
                .where('id', '=', data.queueId)
                .execute();

            return {
                success: true,
                mediaId,
                response: response.data,
            };
        } catch (err: any) {
            const errData = err?.response?.data?.error;
            const errorCode = errData?.code || null;
            const errorMessage = errData?.message || err?.message;

            this.logger.error(`Error memproses queue ID ${data.queueId}: ${errorMessage}`);

            // 1. Gagal log ke audit table system Anda
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
                error_code: errorCode,
                error_message: errorMessage,
                raw_json: JSON.stringify(err?.response?.data || err),
            });

            // 2. Update status antrean menjadi FAILED berdasarkan Primary Key (id) yang presisi
            await this.db
                .updateTable(this.tableQue)
                .set((eb) => ({
                    status: 'FAILED',
                    attempts: eb('attempts', '+', 1), // Increment jumlah percobaan
                    error_message: errorMessage,
                    updated_at: new Date()
                }))
                .where('id', '=', data.queueId)
                .execute();

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

    async listQueue(params) {
        let query = this.db
            .selectFrom(`${this.tableQue} as q`)
            .select([
                'q.id',
                'q.id_uuid',
                'q.phone',
                'q.nik',
                'q.nama',
                'q.periode',
                'q.file_name',
                'q.file_mime',
                // File base64 sengaja di-omisi/tidak diambil agar response tidak berat
                'q.status',
                'q.attempts',
                'q.error_message',
                'q.created_at',
                'q.updated_at',
            ]);

        // Filter berdasarkan nomor telepon (phone)
        if (params.phone) {
            query = query.where('q.phone', 'ilike', `%${params.phone}%`);
        }

        // Filter berdasarkan NIK karyawan
        if (params.nik) {
            query = query.where('q.nik', 'ilike', `%${params.nik}%`);
        }

        // Filter berdasarkan nama karyawan
        if (params.nama) {
            query = query.where('q.nama', 'ilike', `%${params.nama}%`);
        }

        // Filter berdasarkan periode slip gaji (misal: '2026-04')
        if (params.periode) {
            query = query.where('q.periode', 'ilike', `%${params.periode}%`);
        }

        // Filter berdasarkan status antrean ('WAITING', 'PROCESSING', 'SUCCESS', 'FAILED')
        if (params.status) {
            query = query.where('q.status', '=', params.status);
        }

        // Mengatur limitasi jumlah data (default 100, max 1000)
        let limit = Number(params.limit) || 100;
        if (limit > 1000) limit = 1000;

        // Urutkan dari antrean yang paling baru dibuat atau diperbarui
        return query
            .orderBy('q.id', 'desc')
            .limit(limit)
            .execute();
    }
}