// src/wa-api/wa-api.service.ts
import {
    HttpException,
    Inject,
    Injectable,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';

import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import FormData from 'form-data';
import { LoggerService } from 'src/logger/logger.service';
import { Kysely } from 'kysely';
import { getWaPhoneNumbers } from 'src/shared/wa-phone-numbers.util';

@Injectable()
export class WaApiService {
    private readonly logger = new Logger(
        WaApiService.name,
    );

    private readonly waApiBaseUrl = process.env.WA_API_BASE_URL;
    private readonly waApiVersion = process.env.WA_API_VERSION;
    private readonly waToken = process.env.WA_TOKEN;
    private readonly waTemplateSlipGaji = 'slip_gaji_notification';

    @Inject('KYSELY_CONNECTION')
    private readonly db: Kysely<any>;
    private readonly tableAppKey = 'sec.s01_app_key';
    private readonly tableQue = 'que.q01_slip_gaji';
    private readonly tableLog = 'logger.l01_wa_webhook_log';

    constructor(
        private readonly httpService: HttpService,
        private readonly loggerService: LoggerService,
    ) { }

    async validateAppAccess(appKey: string, clientIp: string) {
        // 1. Validasi Key dan Status Aktif
        const appKeyData = await this.db
            .selectFrom(this.tableAppKey)
            .selectAll()
            .where('key', '=', appKey)
            .where('is_active', '=', 'Y')
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        if (!appKeyData) {
            throw new UnauthorizedException('Invalid or inactive APP Key');
        }

        // 1b. Validasi nomor pengirim (wa_phone_id) sudah dikonfigurasi dan terdaftar
        if (!appKeyData.wa_phone_id) {
            throw new UnauthorizedException(`App '${appKeyData.app}' belum memiliki nomor pengirim (wa_phone_id) yang dikonfigurasi`);
        }
        const isRegisteredSender = getWaPhoneNumbers().some((p) => p.id === appKeyData.wa_phone_id);
        if (!isRegisteredSender) {
            throw new UnauthorizedException(`Nomor pengirim (wa_phone_id: ${appKeyData.wa_phone_id}) tidak terdaftar di WA_PHONE_NUMBERS`);
        }

        // 2. Validasi Whitelist IP Address (jika kolom ips di-set)
        if (appKeyData.ips) {
            const allowedIps = appKeyData.ips.split(';').map((ip: string) => ip.trim());
            const isIpWhitelisted = allowedIps.includes(clientIp.trim());

            if (!isIpWhitelisted) {
                throw new UnauthorizedException(`IP Address ${clientIp} is not whitelisted`);
            }
        }

        return appKeyData;
    }

    async validateDevMode(devMode: number, targetPhone: string, waPhoneId: string) {
        // 1. Validasi Khusus Mode DEV: Harus ada interaksi pesan masuk dalam 24 jam terakhir
        if (devMode) {
            // 1. Hitung batas waktu 24 jam ke belakang
            const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

            // 2. Ambil semua log pesan masuk dari nomor tujuan dalam 24 jam terakhir
            const recentLogs = await this.db
                .selectFrom(this.tableLog)
                .select(['raw_json', 'created_at'])
                .where('from_number', '=', targetPhone)
                .where('created_at', '>=', twentyFourHoursAgo) // Filter langsung via indeks waktu DB
                .orderBy('id', 'desc')
                .execute();

            if (recentLogs.length === 0) {
                throw new Error('DEV MODE: Tidak ditemukan interaksi pesan masuk dari nomor ini dalam 24 jam terakhir. Silakan mulai pesan dari nomor penerima.');
            }

            // 3. Validasi metadata phone_number_id dari kolom raw_json di level aplikasi
            let isPhoneNumberIdMatched = false;
            for (const log of recentLogs) {
                try {
                    const payload = typeof log.raw_json === 'string' ? JSON.parse(log.raw_json) : log.raw_json;
                    const valueObj = payload?.entry?.[0]?.changes?.[0]?.value;

                    const metadata = valueObj?.metadata;
                    const logPhoneNumberId = metadata?.phone_number_id;

                    const messageObj = valueObj?.messages?.[0];
                    const waTimestampStr = messageObj?.timestamp;

                    // Validasi kecocokan phone_number_id
                    if (logPhoneNumberId && logPhoneNumberId === waPhoneId) {
                        // Validasi rentang waktu berdasarkan timestamp asli dari server Meta
                        if (waTimestampStr) {
                            const waMessageTimeMs = Number(waTimestampStr) * 1000;
                            const nowMs = Date.now();
                            const twentyFourHoursMs = 24 * 60 * 60 * 1000;

                            if (nowMs - waMessageTimeMs < twentyFourHoursMs) {
                                isPhoneNumberIdMatched = true;
                                this.logger.log(`Sesi gratis valid. Pesan WA asli dikirim pada: ${new Date(waMessageTimeMs).toISOString()}`);
                                break; // Keluar dari loop karena sesi terbukti valid
                            }
                        }
                    }
                } catch (jsonErr) {
                    this.logger.error(`Gagal melakukan parse raw_json pada salah satu log: ${jsonErr.message}`);
                }
            }

            // Jika setelah di-loop tidak ada satu pun objek log yang memenuhi syarat metadata & timestamp
            if (!isPhoneNumberIdMatched) {
                throw new Error(`Mode DEV aktif: Sesi interaksi chat masuk terakhir dengan WhatsApp ID (${waPhoneId}) sudah kadaluarsa atau tidak cocok.`);
            }
        }
    }

    async createQueue(data: {
        phone: string;
        nik: string;
        nama: string;
        periode: string;
        file: Express.Multer.File;
        dev_mode: number;
        app: string;
        wa_phone_id: string;
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
                dev_mode: data.dev_mode,
                app: data.app,
                wa_phone_id: data.wa_phone_id,
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
        dev_mode: number;
        app: string;
        wa_phone_id: string;
    }) {
        // validasi mode

        let mediaId: string | null = null;
        let mediaName: string | null = null;

        try {
            await this.validateDevMode(data.dev_mode, data.phone, data.wa_phone_id);

            // 1. Upload media ke Meta Server
            const media = await this.uploadMedia(data.file, data.wa_phone_id);
            mediaId = media.id;
            mediaName = media.name;

            // 2. Kirim template menggunakan mediaId
            const response = await this.sendTemplate({
                to: data.phone,
                mediaId,
                mediaName,
                nama: data.nama,
                nik: data.nik,
                periode: data.periode,
                waPhoneId: data.wa_phone_id,
            });

            const waMessageId = response?.data?.messages?.[0]?.id;

            // 3. Success log ke audit table system Anda
            const logResult = await this.loggerService.insertWebhookLog({
                app: data.app,
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
                    wa_message_id: logResult?.wa_message_id,
                    status: 'SUCCESS',
                    updated_at: new Date(),
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
            const logResult = await this.loggerService.insertWebhookLog({
                app: data.app,
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
                    wa_message_id: logResult?.wa_message_id,
                    status: 'FAILED',
                    attempts: eb('attempts', '+', 1), // Increment jumlah percobaan
                    error_message: errorMessage,
                    updated_at: new Date(),
                }))
                .where('id', '=', data.queueId)
                .execute();

            throw new HttpException(errorMessage || 'Failed send whatsapp', err?.response?.status || 500);
        }
    }

    private async uploadMedia(
        file: Express.Multer.File,
        waPhoneId: string,
    ): Promise<{ id: string; name: string }> {
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
                `${this.waApiBaseUrl}/${this.waApiVersion}/${waPhoneId}/media`,
                form,
                {
                    headers: {
                        Authorization: `Bearer ${this.waToken}`,
                        ...form.getHeaders(),
                    },
                },
            ),
        );

        return {
            id: response.data.id,
            name: file.originalname,
        };
    }

    private async sendTemplate(data: {
        to: string;
        mediaId: string | null;
        mediaName: string | null;
        nama: string;
        nik: string;
        periode: string;
        waPhoneId: string;
    }) {
        return firstValueFrom(
            this.httpService.post(
                `${this.waApiBaseUrl}/${this.waApiVersion}/${data.waPhoneId}/messages`,
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
                                            filename: data.mediaName,
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
                'q.app',
                'q.wa_message_id',
                'q.created_at',
                'q.updated_at',
            ]);

        // Filter berdasarkan app
        if (params.app) {
            query = query.where('q.app', 'ilike', `%${params.app}%`);
        }

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

    getCleanIp(rawIp: string | undefined): string {
        if (!rawIp) return '';

        // 1. Hapus semua spasi yang tidak sengaja ada di dalam string IP
        let cleanIp = rawIp.replace(/\s+/g, '');

        // 2. Jika IP adalah localhost IPv6 murni (::1), ubah ke format IPv4
        if (cleanIp === '::1') {
            return '127.0.0.1';
        }

        // 3. Buang prefix ::ffff: jika ip berupa IPv4-mapped IPv6
        if (cleanIp.startsWith('::ffff:')) {
            cleanIp = cleanIp.replace('::ffff:', '');
        }

        return cleanIp;
    }

    normalizePhone(phone: string): string {
        const cleanPhone = phone.replace(/\s+/g, '');

        if (cleanPhone.startsWith('+62')) {
            return '62' + cleanPhone.slice(3);
        }

        if (cleanPhone.startsWith('0')) {
            return '62' + cleanPhone.slice(1);
        }

        if (cleanPhone.startsWith('62')) {
            return cleanPhone;
        }

        return '62' + cleanPhone;
    }
}
