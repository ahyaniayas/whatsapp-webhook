import {
    Body,
    Controller,
    FileTypeValidator,
    Get,
    Headers,
    HttpException,
    ParseFilePipe,
    Post,
    Query,
    Req,
    Res,
    UnauthorizedException,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { WaApiService } from './wa-api.service';
import { LoggerService } from 'src/logger/logger.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { navBar } from 'src/shared/html.util';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';

const VALID_LOG_STATUSES = ['requested', 'sent', 'delivered', 'read', 'failed'];

@Controller('api/v1/wa-api')
export class WaApiController {
    private readonly apiKey = process.env.API_KEY;

    constructor(
        private readonly waApiService: WaApiService,
        private readonly loggerService: LoggerService,
    ) { }

    @Get('health')
    healthCheck(@Req() req: Request) {
        // Ambil IP klien menggunakan service kamu
        const clientIp = this.waApiService.getCleanIp(req.ip);

        return {
            status: 'OK', // Indikator bahwa server sedang berjalan (UP)
            ip: clientIp,
            timestamp: new Date().toISOString(), // Opsional: Untuk mengetahui waktu pengecekan
        };
    }

    @Post('send-slip-gaji')
    @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
    async sendSlipGaji(
        @Headers('api-key') hApiKey: string,
        @Headers('app-key') hAppKey: string,
        @UploadedFile(new ParseFilePipe({
            fileIsRequired: true,
            validators: [new FileTypeValidator({ fileType: 'application/pdf' })],
        })) file: Express.Multer.File,
        @Body('phone') phone: string,
        @Body('nik') nik: string,
        @Body('nama') nama: string,
        @Body('periode') periode: string,
        @Req() req: Request,
    ) {
        if (hApiKey !== this.apiKey) {
            throw new UnauthorizedException('Invalid API Key');
        }

        // validasi app access
        const clientIp = this.waApiService.getCleanIp(req.ip);
        const appKeyData = await this.waApiService.validateAppAccess(hAppKey, clientIp);

        // Langsung masukkan ke database tabel antrean
        await this.waApiService.createQueue({
            phone: this.waApiService.normalizePhone(phone),
            nik,
            nama,
            periode,
            file,
            dev_mode: appKeyData.mode === 'DEV' ? 1 : 0,
            app: appKeyData.app,
            wa_phone_id: appKeyData.wa_phone_id,
        })

        return {
            success: true,
            message: 'Slip gaji berhasil dimasukkan ke antrean jadwal pengiriman.',
        };
    }

    @Post('send-slip-gaji-base64')
    async sendSlipGajiBase64(
        @Headers('api-key') hApiKey: string,
        @Headers('app-key') hAppKey: string,
        @Body('phone') phone: string,
        @Body('nik') nik: string,
        @Body('nama') nama: string,
        @Body('periode') periode: string,
        @Body('file') fileBase64: string, // Menerima base64 string
        @Req() req: Request,
    ) {
        // 1. Validasi API Key
        if (hApiKey !== this.apiKey) {
            throw new UnauthorizedException('Invalid API Key');
        }

        // 2. Validasi kelengkapan data
        if (!fileBase64 || !phone || !nik || !nama || !periode) {
            throw new HttpException('Semua field (phone, nik, nama, periode, fileBase64) wajib diisi', 400);
        }

        // 3. Bersihkan prefix Base64 jika client mengirimkan format Data URL 
        // (contoh: "data:application/pdf;base64,JVBERi0...")
        const base64Data = fileBase64.replace(/^data:application\/pdf;base64,/, '');

        // Validasi format Header PDF (File PDF dalam base64 selalu diawali dengan "JVBERi0")
        if (!base64Data.startsWith('JVBERi0')) {
            throw new HttpException('Format fileBase64 tidak valid. Pastikan file adalah PDF.', 400);
        }

        // 4. Konversi Base64 string menjadi Buffer biner murni
        const pdfBuffer = Buffer.from(base64Data, 'base64');

        // 5. Mocking objek Express.Multer.File agar kompatibel dengan Service layer kamu
        const mockFile: Express.Multer.File = {
            fieldname: 'file',
            originalname: `Slip-Gaji-${periode}-${nik}.pdf`,
            encoding: 'base64',
            mimetype: 'application/pdf',
            buffer: pdfBuffer,
            size: pdfBuffer.length,
            // Properti di bawah ini dikosongkan karena menggunakan memoryStorage
            stream: null as any,
            destination: '',
            filename: '',
            path: '',
        };

        // 6. Validasi app access (menggunakan logika kamu yang sudah ada)
        const clientIp = this.waApiService.getCleanIp(req.ip);
        const appKeyData = await this.waApiService.validateAppAccess(hAppKey, clientIp);

        // 7. Masukkan ke database tabel antrean menggunakan service yang sama
        await this.waApiService.createQueue({
            phone: this.waApiService.normalizePhone(phone),
            nik,
            nama,
            periode,
            file: mockFile, // Oper mockFile hasil konversi Base64
            dev_mode: appKeyData.mode === 'DEV' ? 1 : 0,
            app: appKeyData.app,
            wa_phone_id: appKeyData.wa_phone_id,
        });

        return {
            success: true,
            message: 'Slip gaji (Base64) berhasil dimasukkan ke antrean jadwal pengiriman.',
        };
    }

    @Get('queue')
    @UseGuards(AuthGuard)
    async getListQueue(
        @Headers('api-key') hApiKey: string,
        @Query('app') app: string,
        @Query('phone') phone: string,
        @Query('nik') nik: string,
        @Query('nama') nama: string,
        @Query('periode') periode: string,
        @Query('status') status: string,
        @Query('limit') limit: number,
        @Res() res: Response,
    ) {
        // Ambil data antrean dari service menggunakan filter query params
        const rows = await this.waApiService.listQueue({
            app,
            phone,
            nik,
            nama,
            periode,
            status,
            limit: limit ? Number(limit) : undefined,
        });

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Queue Monitor</title>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
                h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
                h1::before { content: ""; display: inline-block; width: 8px; height: 28px; background: #10b981; border-radius: 4px; }
                
                /* Form Filter Dashboard */
                form { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1.25rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05); flex-wrap: wrap; align-items: center; }
                .form-group { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 150px; }
                .form-group label { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                input, select, button { padding: 0.625rem 0.875rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; color: #334155; background-color: white; outline: none; transition: all 0.2s; width: 100%; }
                input:focus, select:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1); }
                input::placeholder { color: #94a3b8; }
                
                button[type="submit"] { background: #10b981; color: white; border: none; font-weight: 600; cursor: pointer; height: 38px; margin-top: auto; padding: 0 1.5rem; width: auto; align-self: flex-end; }
                button[type="submit"]:hover { background: #059669; }
                
                /* Tabel Wrapper */
                .table-wrapper { background: white; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05); overflow-x: auto; border: 1px solid #e2e8f0; -webkit-overflow-scrolling: touch; }
                table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; min-width: 1100px; }
                th { background: #f8fafc; padding: 0.875rem 1rem; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
                td { padding: 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
                tr:last-child td { border-bottom: none; }
                tr:hover td { background: #f8fafc; }
                
                /* Badge Status Utilities */
                .badge { padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; display: inline-block; letter-spacing: 0.02em; }
                .waiting { background: #64748b; }
                .processing { background: #f59e0b; }
                .success { background: #10b981; }
                .failed { background: #ef4444; }
                .app-badge { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; text-transform: none; font-family: monospace; }
                
                .text-muted { color: #94a3b8; }
                .font-mono { font-family: monospace; font-size: 0.9rem; }
                .error-box { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #ef4444; font-size: 0.8rem; }
                
                /* Action Button Component */
                .btn-action { display: inline-block; padding: 0.375rem 0.75rem; background: #6366f1; color: white; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-decoration: none; transition: background 0.2s; }
                .btn-action:hover { background: #4f46e5; }
                .btn-disabled { display: inline-block; padding: 0.375rem 0.75rem; background: #e2e8f0; color: #94a3b8; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: not-allowed; text-decoration: none; }

                @media (max-width: 640px) {
                    .container { padding: 1rem !important; }
                    h1 { font-size: 1.375rem; }
                    form { gap: 0.625rem; padding: 1rem; }
                    .form-group { min-width: 100%; }
                    button[type="submit"] { width: 100%; align-self: stretch; margin-top: 0.25rem; }
                }
            </style>
        </head>
        <body>
            ${navBar('queue')}
            <div class="container" style="padding:2rem;">
                <h1>WhatsApp Queue Monitor</h1>
                
                <form method="GET">
                    <div class="form-group">
                        <label>APP</label>
                        <input type="text" name="app" placeholder="e.g. APP..." value="${app || ''}" />
                    </div>

                    <div class="form-group">
                        <label>Phone Number</label>
                        <input type="text" name="phone" placeholder="e.g. 628..." value="${phone || ''}" />
                    </div>

                    <div class="form-group">
                        <label>NIK</label>
                        <input type="text" name="nik" placeholder="e.g. 320..." value="${nik || ''}" />
                    </div>
                    
                    <div class="form-group">
                        <label>Nama</label>
                        <input type="text" name="nama" placeholder="Nama karyawan" value="${nama || ''}" />
                    </div>

                    <div class="form-group">
                        <label>Periode</label>
                        <input type="text" name="periode" placeholder="e.g. 2026-04" value="${periode || ''}" />
                    </div>
                    
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="">All Statuses</option>
                            <option value="WAITING" ${status === 'WAITING' ? 'selected' : ''}>WAITING</option>
                            <option value="PROCESSING" ${status === 'PROCESSING' ? 'selected' : ''}>PROCESSING</option>
                            <option value="SUCCESS" ${status === 'SUCCESS' ? 'selected' : ''}>SUCCESS</option>
                            <option value="FAILED" ${status === 'FAILED' ? 'selected' : ''}>FAILED</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label>Limit</label>
                        <select name="limit">
                            <option value="10" ${Number(limit) === 10 ? 'selected' : ''}>10 Rows</option>
                            <option value="50" ${Number(limit) === 50 ? 'selected' : ''}>50 Rows</option>
                            <option value="100" ${!limit || Number(limit) === 100 ? 'selected' : ''}>100 Rows</option>
                            <option value="250" ${Number(limit) === 250 ? 'selected' : ''}>250 Rows</option>
                            <option value="500" ${Number(limit) === 500 ? 'selected' : ''}>500 Rows</option>
                            <option value="1000" ${Number(limit) === 1000 ? 'selected' : ''}>1000 Rows</option>
                        </select>
                    </div>

                    <button type="submit">Filter</button>
                </form>

                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Created At</th>
                                <th>App</th>
                                <th>NIK</th>
                                <th>Nama</th>
                                <th>Phone</th>
                                <th>Periode</th>
                                <th>File Name</th>
                                <th>Attempts</th>
                                <th>Status</th>
                                <th>Error Message</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length === 0 ? `<tr><td colspan="12" style="text-align: center;" class="text-muted">Tidak ada antrean ditemukan</td></tr>` : ''}
                            ${rows.map((row) => {
            const date = new Date(row.created_at);
            const formattedDate = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + '.' + String(date.getMilliseconds()).padStart(3, '0');

            // Logika tombol Lihat Log kondisional
            const actionButton = row.wa_message_id
                ? `<a href="/logger/${row.wa_message_id}" class="btn-action" target="_blank">Lihat Log</a>`
                : `<span class="btn-disabled" title="Pesan belum diproses/tidak ada Message ID">Lihat Log</span>`;

            return `
                                <tr>
                                    <td class="font-mono text-muted">${row.id}</td>
                                    <td class="font-mono">${formattedDate}</td>
                                    <td><span class="badge app-badge">${row.app || '-'}</span></td>
                                    <td>${row.nik}</td>
                                    <td><strong>${row.nama}</strong></td>
                                    <td class="font-mono">${row.phone}</td>
                                    <td><span class="badge waiting">${row.periode}</span></td>
                                    <td class="text-muted" style="font-size: 0.8rem;">${row.file_name}</td>
                                    <td style="text-align: center;"><span class="font-mono">${row.attempts}</span></td>
                                    <td>
                                        <span class="badge ${row.status.toLowerCase()}">
                                            ${row.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="error-box" title="${row.error_message || ''}">
                                            ${row.error_message || '<span class="text-muted">-</span>'}
                                        </div>
                                    </td>
                                    <td>${actionButton}</td>
                                </tr>
                                `;
        }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
        `;

        // Atur header respon ke format HTML text
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    @Get('log')
    async getLog(
        @Headers('api-key') hApiKey: string,
        @Headers('app-key') hAppKey: string,
        @Query('wa_message_id') waMessageId: string,
        @Query('date_from') dateFrom: string,
        @Query('date_to') dateTo: string,
        @Query('status') status: string,
        @Query('limit') limit: number,
        @Req() req: Request,
    ) {
        if (hApiKey !== this.apiKey) {
            throw new UnauthorizedException('Invalid API Key');
        }

        if (!dateFrom || !dateTo) {
            throw new HttpException('Parameter date_from dan date_to wajib diisi', 400);
        }

        if (status && !VALID_LOG_STATUSES.includes(status)) {
            throw new HttpException(`Parameter status tidak valid. Nilai yang diperbolehkan: ${VALID_LOG_STATUSES.join(', ')}`, 400);
        }

        // validasi app access, appKeyData.app dipakai sebagai filter app yang wajib
        const clientIp = this.waApiService.getCleanIp(req.ip);
        const appKeyData = await this.waApiService.validateAppAccess(hAppKey, clientIp);

        const rows = await this.loggerService.list({
            app: appKeyData.app,
            waMessageId,
            dateFrom,
            dateTo,
            status,
            limit: limit ? Number(limit) : undefined,
        });

        return {
            success: true,
            data: rows,
        };
    }
}
