import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { LoggerService } from './logger.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { navBar } from 'src/shared/html.util';

@Controller('logger')
export class LoggerController {
    constructor(private readonly loggerService: LoggerService) { }

    @Get()
    @UseGuards(AuthGuard)
    async list(
        @Query('waMessageId') waMessageId: string,
        @Query('from') from: string,
        @Query('to') to: string,
        @Query('status') status: string,
        @Query('app') app: string,
        @Query('limit') limit: number,
        @Res() res: Response,
    ) {
        // Mengambil data log dari service dengan parameter filter lengkap
        if (limit > 1000) limit = 1000;
        const rows = await this.loggerService.list({ waMessageId, from, to, status, app, limit });

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Message Logger</title>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
                h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 1.5rem; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
                h1::before { content: ""; display: inline-block; width: 8px; height: 28px; background: #6366f1; border-radius: 4px; }
                
                /* Form Filter Dashboard */
                form { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; padding: 1.25rem; background: white; border-radius: 12px; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05); flex-wrap: wrap; align-items: center; }
                .form-group { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 150px; }
                .form-group label { font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                input, select, button { padding: 0.625rem 0.875rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; color: #334155; background-color: white; outline: none; transition: all 0.2s; width: 100%; }
                input:focus, select:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1); }
                input::placeholder { color: #94a3b8; }
                
                button[type="submit"] { background: #6366f1; color: white; border: none; font-weight: 600; cursor: pointer; height: 38px; margin-top: auto; padding: 0 1.5rem; width: auto; align-self: flex-end; }
                button[type="submit"]:hover { background: #4f46e5; }
                
                /* Tabel Wrapper & Scroll Horizontal */
                .table-wrapper { 
                    background: white; 
                    border-radius: 12px; 
                    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05); 
                    border: 1px solid #e2e8f0; 
                    overflow-x: auto; 
                    width: 100%;
                    -webkit-overflow-scrolling: touch;
                }
                table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    text-align: left; 
                    font-size: 0.875rem; 
                    min-width: 1300px; 
                }
                th { background: #f8fafc; padding: 0.875rem 1rem; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.05em; }
                td { padding: 1rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
                tr:last-child td { border-bottom: none; }
                tr:hover td { background: #f8fafc; }
                
                /* Badge Status Utilities */
                .status-container { display: flex; gap: 0.375rem; flex-wrap: wrap; align-items: center; }
                .badge { padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; display: inline-block; letter-spacing: 0.02em; }
                .requested { background: #f59e0b; }
                .sent { background: #3b82f6; }
                .delivered { background: #06b6d4; }
                .read { background: #10b981; }
                .failed { background: #ef4444; }
                .null { background: #e2e8f0; color: #475569; }
                .app-badge { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; text-transform: none; font-family: monospace; }
                
                .text-muted { color: #94a3b8; }
                .font-mono { font-family: monospace; font-size: 0.9rem; }

                /* Action Button Component */
                .btn-action { display: inline-block; padding: 0.375rem 0.75rem; background: #6366f1; color: white; border-radius: 6px; font-size: 0.75rem; font-weight: 600; text-decoration: none; transition: background 0.2s; white-space: nowrap; }
                .btn-action:hover { background: #4f46e5; }
                .btn-disabled { display: inline-block; padding: 0.375rem 0.75rem; background: #e2e8f0; color: #94a3b8; border-radius: 6px; font-size: 0.75rem; font-weight: 600; cursor: not-allowed; text-decoration: none; white-space: nowrap; }

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
            ${navBar('logger')}
            <div class="container" style="padding:2rem;">
                <h1>WhatsApp Message Logger</h1>
                
                <form method="GET">
                    <div class="form-group">
                        <label>Message ID</label>
                        <input type="text" name="waMessageId" placeholder="e.g. false_628..." value="${waMessageId || ''}" />
                    </div>

                    <div class="form-group">
                        <label>App Name</label>
                        <input type="text" name="app" placeholder="e.g. hris" value="${app || ''}" />
                    </div>

                    <div class="form-group">
                        <label>From Number</label>
                        <input type="text" name="from" placeholder="e.g. 62812..." value="${from || ''}" />
                    </div>
                    
                    <div class="form-group">
                        <label>To Number</label>
                        <input type="text" name="to" placeholder="e.g. 62857..." value="${to || ''}" />
                    </div>
                    
                    <div class="form-group">
                        <label>Status</label>
                        <select name="status">
                            <option value="">All Statuses</option>
                            <option value="requested" ${status === 'requested' ? 'selected' : ''}>Requested</option>
                            <option value="sent" ${status === 'sent' ? 'selected' : ''}>Sent</option>
                            <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>Delivered</option>
                            <option value="read" ${status === 'read' ? 'selected' : ''}>Read</option>
                            <option value="failed" ${status === 'failed' ? 'selected' : ''}>Failed</option>
                            <option value="null" ${status === 'null' ? 'selected' : ''}>NULL</option>
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
                                <th>Created At</th>
                                <th>App</th>
                                <th>From</th>
                                <th>To</th>
                                <th>Message ID</th>
                                <th>Type</th>
                                <th>Billable</th>
                                <th>Latest Error</th>
                                <th>Status History</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.length === 0 ? `<tr><td colspan="10" style="text-align: center;" class="text-muted">Tidak ada log ditemukan</td></tr>` : ''}
                            ${rows.map((row) => {
            const date = new Date(row.created_at);
            const formattedDate = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + '.' + String(date.getMilliseconds()).padStart(3, '0');

            const uniqueApps = row.statuses && Array.isArray(row.statuses)
                ? [...new Set(row.statuses.map((st) => st.app).filter(Boolean))]
                : [];

            const appDisplay = uniqueApps.length > 0
                ? uniqueApps.map(appName => `<span class="badge app-badge">${appName}</span>`).join(', ')
                : '<span class="text-muted">-</span>';

            const statusBadges = row.statuses && Array.isArray(row.statuses)
                ? row.statuses.map((st) => `
                                            <span class="badge ${st.status || 'null'}" title="Logged at: ${st.created_at}">
                                                ${st.status || 'NULL'}
                                            </span>
                                          `).join('')
                : '<span class="text-muted">-</span>';

            const uniqueTypes = row.statuses && Array.isArray(row.statuses)
                ? [...new Set(row.statuses.map((st) => st.message_type ? st.message_type : '-'))]
                : [];

            const typeDisplay = uniqueTypes.length > 0
                ? uniqueTypes.map(type => `<span class="text-muted">${type}</span>`).join(', ')
                : '<span class="text-muted">-</span>';

            const uniqueBillings = row.statuses && Array.isArray(row.statuses)
                ? [...new Set(row.statuses.map((st) => st.pricing_billable ? st.pricing_billable : '-'))]
                : [];

            const billingDisplay = uniqueBillings.length > 0
                ? uniqueBillings.map(bill => `<span class="text-muted">${bill}</span>`).join(', ')
                : '<span class="text-muted">-</span>';

            const uniqueErrors = row.statuses && Array.isArray(row.statuses)
                ? [...new Set(row.statuses.map((st) => st.error_title ? st.error_title : '-'))]
                : [];

            const errorDisplay = uniqueErrors.length > 0
                ? uniqueErrors.map(er => `<span class="text-muted">${er}</span>`).join(', ')
                : '<span class="text-muted">-</span>';

            // Tombol aksi pembuka tab baru yang aman
            const actionButton = row.wa_message_id
                ? `<a href="/logger/${row.wa_message_id}" class="btn-action" rel="noopener noreferrer">Detail</a>`
                : `<span class="btn-disabled" title="Data log tidak valid/Message ID kosong">Lihat Log</span>`;

            return `
                                <tr>
                                    <td class="font-mono">${formattedDate}</td>
                                    <td>${appDisplay}</td>
                                    <td>${row.from_number || '<span class="text-muted">-</span>'}</td>
                                    <td>${row.to_number || '<span class="text-muted">-</span>'}</td>
                                    <td class="font-mono text-muted">${row.wa_message_id || '<span class="text-muted">-</span>'}</td>
                                    <td>
                                        <span class="text-muted">
                                            ${typeDisplay}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="text-muted">
                                            ${billingDisplay}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="text-muted">
                                            ${errorDisplay}
                                        </span>
                                    </td>
                                    <td>
                                        <div class="status-container">
                                            ${statusBadges}
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

        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    @Get(':waMessageId')
    @UseGuards(AuthGuard)
    async detail(@Param('waMessageId') waMessageId: string, @Res() res: Response) {
        const rows = await this.loggerService.detail(waMessageId);

        const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>WhatsApp Message Logger - Detail</title>
            <link rel="icon" type="image/svg+xml" href="/favicon.svg">
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
                .container { overflow-x: hidden; }

                .header-wrapper { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
                h1::before { content: ""; display: inline-block; width: 8px; height: 28px; background: #6366f1; border-radius: 4px; }
                
                /* Tombol Kembali */
                .btn-back { display: inline-flex; align-items: center; padding: 0.5rem 1rem; background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; font-weight: 600; text-decoration: none; transition: all 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
                .btn-back:hover { background: #f1f5f9; color: #1e293b; border-color: #94a3b8; }
                
                /* Card Detail */
                .card { background: white; padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; min-width: 0; overflow-wrap: anywhere; }
                .card-header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid #f1f5f9; }
                .card-meta { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; font-size: 0.875rem; }
                .card-meta p { word-break: break-word; }
                
                /* Badge Status Utilities */
                .badge { padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.75rem; font-weight: 600; color: white; text-transform: uppercase; display: inline-block; letter-spacing: 0.02em; }
                .requested { background: #f59e0b; }
                .sent { background: #3b82f6; }
                .delivered { background: #06b6d4; }
                .read { background: #10b981; }
                .failed { background: #ef4444; }
                .null { background: #e2e8f0; color: #475569; }
                .app-badge { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; text-transform: none; font-family: monospace; display: inline-block; width: fit-content; }
                
                /* JSON Viewer Code block */
                pre { background: #0f172a; color: #e2e8f0; padding: 1.25rem; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 0.85rem; line-height: 1.5; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); white-space: pre-wrap; word-break: break-all; max-width: 100%; }
                .text-muted { color: #94a3b8; }
                .text-danger { color: #b91c1c; font-weight: 500; }
                .font-mono { font-family: monospace; font-size: 0.9rem; word-break: break-all; }

                @media (max-width: 640px) {
                    .container { padding: 1rem !important; }
                    .header-wrapper { flex-wrap: wrap; gap: 0.75rem; }
                    h1 { font-size: 1.375rem; }
                }
            </style>
        </head>
        <body>
            ${navBar('logger')}
            <div class="container" style="padding:2rem;">
                <div class="header-wrapper">
                    <h1>WhatsApp Message Logger - Detail</h1>
                    <a href="/logger" class="btn-back">&larr; Kembali</a>
                </div>

                ${rows.length === 0 ? `<div class="card"><p class="text-muted" style="text-align: center;">Data detail log tidak ditemukan.</p></div>` : ''}
                ${rows.map((row) => {
            const date = new Date(row.created_at);
            const formattedDate = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) + '.' + String(date.getMilliseconds()).padStart(3, '0');

            return `
                    <div class="card">
                        <div class="card-header">
                            <span class="badge ${row.message_status || 'null'}">
                                ${row.message_status || 'NULL'}
                            </span>
                            <span class="font-mono text-muted" style="font-size: 0.8rem;">ID: ${waMessageId}</span>
                        </div>
                        
                        <div class="card-meta">
                            <p><b>App Initiator:</b> <span class="badge app-badge">${row.app || '-'}</span></p> <p><b>Created At:</b> <span class="font-mono">${formattedDate}</span></p>
                            <p><b>Error Message:</b> <span class="${row.error_message ? 'text-danger' : 'text-muted'}">${row.error_message || '-'}</span></p>
                        </div>
                        
                        <pre><code>${JSON.stringify(row.raw_json, null, 2)}</code></pre>
                    </div>
                    `;
        }).join('')}
            </div>
        </body>
        </html>
        `;

        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }
}
