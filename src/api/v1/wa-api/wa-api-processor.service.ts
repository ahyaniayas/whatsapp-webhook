import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Kysely } from 'kysely';
import { WaApiService } from './wa-api.service';

/**
 * Service Processor untuk menangani antrean pengiriman WhatsApp secara background task.
 * Memanfaatkan PostgreSQL FOR UPDATE SKIP LOCKED untuk konkurensi yang aman.
 */
@Injectable()
export class WaApiProcessorService {
    private readonly logger = new Logger(WaApiProcessorService.name);

    // Flag untuk mengunci eksekusi cron agar tidak berjalan tumpang tindih
    private isProcessing = false;

    // Nama tabel antrean pada skema database
    private readonly tableQue = 'que.q01_slip_gaji';

    // Jumlah maksimal pengiriman data paralel dalam satu batch
    private readonly maxConcurrency = 3;

    // Waktu jeda (delay) antar-batch dalam milidetik (e.g., 3000ms = 3 detik)
    private readonly batchDelayMs = 5000;

    constructor(
        @Inject('KYSELY_CONNECTION')
        private readonly db: Kysely<any>,
        private readonly waApiService: WaApiService,
    ) { }

    /**
     * Helper utility untuk menahan jalannya eksekusi kode (asynchronous sleep).
     * @param ms Durasi jeda dalam milidetik
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Background task yang berjalan otomatis setiap 15 detik untuk memproses antrean.
     * Mengambil data berstatus 'WAITING' dan memprosesnya secara batch paralel.
     */
    @Cron('*/15 * * * * *')
    async handleQueue() {
        // Mencegah iterasi baru berjalan jika batch dari cron sebelumnya belum selesai
        if (this.isProcessing) {
            this.logger.debug('Proses batch sebelumnya belum selesai, melewati iterasi ini.');
            return;
        }
        this.isProcessing = true;

        try {
            let hasMoreData = true;

            // Terus putar loop jika database masih memiliki antrean berstatus 'WAITING'
            while (hasMoreData) {
                const promises: Promise<void>[] = [];

                // Mengumpulkan job sebanyak batas maksimal konkurensi (maxConcurrency)
                for (let i = 0; i < this.maxConcurrency; i++) {

                    // Langkah 1: Ambil dan kunci 1 baris data teratas menggunakan transaksi atomik
                    const job = await this.db.transaction().execute(async (trx) => {
                        const nextJob = await trx
                            .selectFrom(this.tableQue)
                            .selectAll()
                            .where('status', '=', 'WAITING')
                            .orderBy('id', 'asc')
                            .limit(1)
                            .forUpdate()
                            .skipLocked()
                            .executeTakeFirst();

                        // Jika data ditemukan, langsung amankan statusnya menjadi 'PROCESSING'
                        if (nextJob) {
                            await trx
                                .updateTable(this.tableQue)
                                .set({
                                    status: 'PROCESSING',
                                    updated_at: new Date(),
                                })
                                .where('id', '=', nextJob.id)
                                .execute();
                        }
                        return nextJob;
                    });

                    // Jika tidak ada lagi data berstatus WAITING, hentikan loop pencarian batch
                    if (!job) {
                        break;
                    }

                    // Langkah 2: Bungkus logika eksekusi ke dalam Promise asinkronus (IIFE)
                    const jobPromise = (async () => {
                        try {
                            this.logger.log(`[Parallel] Memproses ID: ${job.id} - Karyawan: ${job.nama}`);

                            // Rekonstruksi string Base64 dari database kembali menjadi Express.Multer.File Buffer
                            const multerFile: Express.Multer.File = {
                                originalname: job.file_name,
                                mimetype: job.file_mime,
                                buffer: Buffer.from(job.file_base64, 'base64'),
                                fieldname: 'file',
                                encoding: '7bit',
                                size: Buffer.from(job.file_base64, 'base64').length,
                                stream: null as any,
                                destination: '',
                                filename: '',
                                path: '',
                            };

                            // Eksekusi pengiriman via WhatsApp API
                            await this.waApiService.sendSlipGaji({
                                queueId: job.id,
                                phone: job.phone,
                                nik: job.nik,
                                nama: job.nama,
                                periode: job.periode,
                                file: multerFile,
                                dev_mode: job.dev_mode,
                                app: job.app,
                                wa_phone_id: job.wa_phone_id,
                            });

                        } catch (jobErr: any) {
                            // Isolasi error per job agar tidak menggagalkan proses job lain dalam batch yang sama
                            this.logger.error(`[Job Error] Gagal pada ID ${job.id}: ${jobErr.message}`);
                        }
                    })();

                    promises.push(jobPromise);
                }

                // Jika array promises kosong, artinya seluruh antrean di DB telah habis diproses
                if (promises.length === 0) {
                    hasMoreData = false;
                } else {
                    this.logger.log(`[Batch] Menjalankan ${promises.length} pengiriman WhatsApp secara paralel.`);

                    // Langkah 3: Jalankan seluruh pengiriman dalam batch ini secara bersamaan
                    await Promise.all(promises);

                    // Langkah 4: Berikan jeda waktu (throttle) sebelum masuk ke batch berikutnya
                    if (this.batchDelayMs > 0) {
                        this.logger.log(`[Batch] Menunggu jeda antrean selama ${this.batchDelayMs / 1000} detik...`);
                        await this.sleep(this.batchDelayMs);
                    }
                }
            }

        } catch (err: any) {
            this.logger.error(`[Processor Error] Gagal mengeksekusi batch: ${err.message}`);
        } finally {
            // Pastikan flag selalu di-reset ke false agar cron berikutnya dapat berjalan kembali
            this.isProcessing = false;
        }
    }
}