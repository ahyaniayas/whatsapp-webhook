import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { AccessLogService } from './access-log.service';
import { navBar, escapeHtml } from '../shared/html.util';

function statusBadge(code: number | null): string {
    if (!code) return `<span class="badge status-null">-</span>`;
    let cls = 'status-5xx';
    if (code < 300) cls = 'status-2xx';
    else if (code < 400) cls = 'status-3xx';
    else if (code < 500) cls = 'status-4xx';
    return `<span class="badge ${cls}">${code}</span>`;
}

function methodBadge(method: string): string {
    const cls: Record<string, string> = {
        GET: 'method-get', POST: 'method-post',
        PUT: 'method-put', DELETE: 'method-delete',
        PATCH: 'method-patch',
    };
    return `<span class="badge ${cls[method] || 'method-other'}">${escapeHtml(method)}</span>`;
}

function timeBadge(ms: number | null): string {
    if (ms === null || ms === undefined) return '<span class="text-muted">-</span>';
    const cls = ms < 100 ? 'time-fast' : ms < 500 ? 'time-mid' : 'time-slow';
    return `<span class="${cls}">${ms} ms</span>`;
}

function prettyJson(val: any): string {
    if (val === null || val === undefined) return '<span class="text-muted">-</span>';
    try {
        const str = typeof val === 'string' ? val : JSON.stringify(val, null, 2);
        return `<pre class="json-block"><code>${escapeHtml(str)}</code></pre>`;
    } catch {
        return `<pre class="json-block"><code>${escapeHtml(String(val))}</code></pre>`;
    }
}

@Controller('access-log')
@UseGuards(AuthGuard)
export class AccessLogController {
    constructor(private readonly accessLogService: AccessLogService) {}

    @Get()
    async list(
        @Query('app_name') appName: string,
        @Query('client_ip') clientIp: string,
        @Query('method') method: string,
        @Query('status') statusGroup: string,
        @Query('endpoint') endpoint: string,
        @Query('date_from') dateFrom: string,
        @Query('date_to') dateTo: string,
        @Query('limit') limit: number,
        @Res() res: Response,
    ) {
        const rows = await this.accessLogService.list({
            appName: appName || undefined,
            clientIp: clientIp || undefined,
            method: method || undefined,
            statusGroup: statusGroup || undefined,
            endpoint: endpoint || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            limit: limit ? Number(limit) : undefined,
        });

        const tableRows = rows.map((r) => {
            const date = new Date(r.created_at);
            const fmt = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) +
                '.' + String(date.getMilliseconds()).padStart(3, '0');
            const ep = r.endpoint || '';
            const epShort = ep.length > 60 ? ep.substring(0, 60) + '…' : ep;

            return `<tr>
                <td class="font-mono" style="font-size:0.8rem;white-space:nowrap;">${fmt}</td>
                <td class="font-mono text-muted" style="font-size:0.8rem;">${escapeHtml(r.client_ip || '-')}</td>
                <td>${r.app_name ? `<span class="badge app-badge">${escapeHtml(r.app_name)}</span>` : '<span class="text-muted">-</span>'}</td>
                <td>${methodBadge(r.http_method)}</td>
                <td class="font-mono" style="font-size:0.8rem;" title="${escapeHtml(ep)}">${escapeHtml(epShort)}</td>
                <td>${statusBadge(r.status_code)}</td>
                <td style="text-align:right;">${timeBadge(r.response_time_ms)}</td>
                <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.8rem;color:#ef4444;" title="${escapeHtml(r.error_message || '')}">${r.error_message ? escapeHtml(r.error_message) : '<span class="text-muted">-</span>'}</td>
                <td class="text-muted" style="font-size:0.8rem;">${escapeHtml(r.created_by || '-')}</td>
                <td><a href="/access-log/${r.id_uuid}" class="btn-detail">Detail</a></td>
            </tr>`;
        }).join('');

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Log - WhatsApp Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
        main { padding: 2rem; }
        h1 { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; }
        h1::before { content: ""; display: inline-block; width: 8px; height: 28px; background: #8b5cf6; border-radius: 4px; }

        /* Filter */
        .filter-card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .filter-row { display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end; }
        .fg { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 130px; }
        .fg label { font-size: 0.7rem; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; }
        input[type="text"], input[type="date"], select { padding: 0.5rem 0.75rem; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; color: #334155; background: white; outline: none; width: 100%; transition: border-color 0.2s; }
        input:focus, select:focus { border-color: #8b5cf6; box-shadow: 0 0 0 3px rgba(139,92,246,0.1); }
        input::placeholder { color: #94a3b8; }
        .btn-filter { background: #8b5cf6; color: white; border: none; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; padding: 0.5625rem 1.125rem; cursor: pointer; height: 36px; white-space: nowrap; transition: background 0.2s; }
        .btn-filter:hover { background: #7c3aed; }
        .btn-reset { background: white; color: #64748b; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; padding: 0.5rem 1rem; cursor: pointer; white-space: nowrap; text-decoration: none; display: inline-flex; align-items: center; height: 36px; }
        .btn-reset:hover { background: #f8fafc; }

        /* Table */
        .meta { font-size: 0.8125rem; color: #64748b; margin-bottom: 0.625rem; }
        .table-wrapper { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow-x: auto; box-shadow: 0 1px 3px rgba(0,0,0,0.04); -webkit-overflow-scrolling: touch; }
        table { width: 100%; border-collapse: collapse; text-align: left; font-size: 0.875rem; min-width: 1100px; }
        th { background: #f8fafc; padding: 0.75rem 0.875rem; font-weight: 600; color: #475569; border-bottom: 1px solid #e2e8f0; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; }
        td { padding: 0.75rem 0.875rem; border-bottom: 1px solid #f1f5f9; color: #334155; vertical-align: middle; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: #f8fafc; }

        /* Badges */
        .badge { padding: 0.2rem 0.5rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
        .status-2xx { background: #dcfce7; color: #15803d; }
        .status-3xx { background: #dbeafe; color: #1d4ed8; }
        .status-4xx { background: #fef3c7; color: #b45309; }
        .status-5xx { background: #fee2e2; color: #b91c1c; }
        .status-null { background: #f1f5f9; color: #64748b; }
        .method-get    { background: #dbeafe; color: #1d4ed8; }
        .method-post   { background: #dcfce7; color: #15803d; }
        .method-put    { background: #fef3c7; color: #b45309; }
        .method-delete { background: #fee2e2; color: #b91c1c; }
        .method-patch  { background: #f3e8ff; color: #6d28d9; }
        .method-other  { background: #f1f5f9; color: #475569; }
        .app-badge { background: #e0f2fe; color: #0369a1; font-size: 0.75rem; font-family: monospace; }

        .time-fast { color: #15803d; font-weight: 600; font-size: 0.8125rem; }
        .time-mid  { color: #b45309; font-weight: 600; font-size: 0.8125rem; }
        .time-slow { color: #b91c1c; font-weight: 600; font-size: 0.8125rem; }

        .font-mono { font-family: monospace; }
        .text-muted { color: #94a3b8; }
        .btn-detail { display: inline-block; padding: 0.25rem 0.625rem; background: #f3e8ff; color: #6d28d9; border-radius: 5px; font-size: 0.75rem; font-weight: 600; text-decoration: none; }
        .btn-detail:hover { background: #e9d5ff; }
    </style>
</head>
<body>
    ${navBar('access-log')}
    <main>
        <h1>Access Log</h1>

        <div class="filter-card">
            <form class="filter-row" method="GET" action="/access-log">
                <div class="fg">
                    <label>App Name</label>
                    <input type="text" name="app_name" value="${escapeHtml(appName || '')}" placeholder="Cari app..." />
                </div>
                <div class="fg">
                    <label>Client IP</label>
                    <input type="text" name="client_ip" value="${escapeHtml(clientIp || '')}" placeholder="e.g. 192.168.1.1" />
                </div>
                <div class="fg" style="max-width:110px;">
                    <label>Method</label>
                    <select name="method">
                        <option value="">Semua</option>
                        ${['GET','POST','PUT','PATCH','DELETE'].map(m =>
                            `<option value="${m}" ${method === m ? 'selected' : ''}>${m}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="fg" style="max-width:110px;">
                    <label>Status</label>
                    <select name="status">
                        <option value="">Semua</option>
                        ${['2xx','3xx','4xx','5xx'].map(s =>
                            `<option value="${s}" ${statusGroup === s ? 'selected' : ''}>${s}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="fg">
                    <label>Endpoint</label>
                    <input type="text" name="endpoint" value="${escapeHtml(endpoint || '')}" placeholder="/api/v1/..." />
                </div>
                <div class="fg" style="max-width:145px;">
                    <label>Dari Tanggal</label>
                    <input type="date" name="date_from" value="${escapeHtml(dateFrom || '')}" />
                </div>
                <div class="fg" style="max-width:145px;">
                    <label>Sampai Tanggal</label>
                    <input type="date" name="date_to" value="${escapeHtml(dateTo || '')}" />
                </div>
                <div class="fg" style="max-width:110px;">
                    <label>Limit</label>
                    <select name="limit">
                        ${[50, 100, 250, 500].map(l =>
                            `<option value="${l}" ${Number(limit) === l || (!limit && l === 100) ? 'selected' : ''}>${l} rows</option>`
                        ).join('')}
                    </select>
                </div>
                <button type="submit" class="btn-filter">Filter</button>
                <a href="/access-log" class="btn-reset">Reset</a>
            </form>
        </div>

        <div class="meta">Menampilkan <strong>${rows.length}</strong> record</div>

        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Waktu</th>
                        <th>Client IP</th>
                        <th>App</th>
                        <th>Method</th>
                        <th>Endpoint</th>
                        <th>Status</th>
                        <th style="text-align:right;">Response Time</th>
                        <th>Error</th>
                        <th>User</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length === 0
                        ? '<tr><td colspan="10" style="text-align:center;padding:2rem;" class="text-muted">Tidak ada data</td></tr>'
                        : tableRows}
                </tbody>
            </table>
        </div>
    </main>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    @Get(':id_uuid')
    async detail(@Param('id_uuid') idUuid: string, @Res() res: Response) {
        const row = await this.accessLogService.detail(idUuid);

        if (!row) {
            res.setHeader('Content-Type', 'text/html');
            return res.status(404).send('<p>Not found</p>');
        }

        const date = new Date(row.created_at);
        const fmt = date.toLocaleString('sv-SE', { timeZone: 'Asia/Jakarta' }) +
            '.' + String(date.getMilliseconds()).padStart(3, '0');

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Access Log Detail #${row.id} - WhatsApp Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
        main { padding: 2rem; max-width: 1100px; }
        .page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; display: flex; align-items: center; gap: 0.5rem; }
        h1::before { content: ""; display: inline-block; width: 8px; height: 24px; background: #8b5cf6; border-radius: 4px; }
        .btn-back { display: inline-flex; align-items: center; padding: 0.5rem 1rem; background: white; color: #475569; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.875rem; font-weight: 600; text-decoration: none; }
        .btn-back:hover { background: #f1f5f9; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .card.full { grid-column: 1 / -1; }
        .card-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem; }
        .info-row { display: flex; gap: 0.75rem; margin-bottom: 0.625rem; font-size: 0.875rem; }
        .info-label { font-weight: 600; color: #64748b; min-width: 130px; flex-shrink: 0; }
        .info-value { color: #0f172a; word-break: break-all; }

        .badge { padding: 0.2rem 0.5rem; border-radius: 5px; font-size: 0.75rem; font-weight: 600; display: inline-block; }
        .status-2xx { background: #dcfce7; color: #15803d; }
        .status-3xx { background: #dbeafe; color: #1d4ed8; }
        .status-4xx { background: #fef3c7; color: #b45309; }
        .status-5xx { background: #fee2e2; color: #b91c1c; }
        .status-null { background: #f1f5f9; color: #64748b; }
        .method-get    { background: #dbeafe; color: #1d4ed8; }
        .method-post   { background: #dcfce7; color: #15803d; }
        .method-put    { background: #fef3c7; color: #b45309; }
        .method-delete { background: #fee2e2; color: #b91c1c; }
        .method-patch  { background: #f3e8ff; color: #6d28d9; }
        .method-other  { background: #f1f5f9; color: #475569; }
        .time-fast { color: #15803d; font-weight: 600; }
        .time-mid  { color: #b45309; font-weight: 600; }
        .time-slow { color: #b91c1c; font-weight: 600; }

        .json-block { background: #0f172a; color: #e2e8f0; padding: 1rem 1.25rem; border-radius: 8px; overflow-x: auto; font-family: monospace; font-size: 0.8rem; line-height: 1.6; margin-top: 0.5rem; max-height: 360px; overflow-y: auto; }
        .text-muted { color: #94a3b8; }
        .font-mono { font-family: monospace; }
        .error-text { color: #b91c1c; font-size: 0.875rem; }

        @media (max-width: 700px) { .grid { grid-template-columns: 1fr; } .card.full { grid-column: 1; } }
    </style>
</head>
<body>
    ${navBar('access-log')}
    <main>
        <div class="page-header">
            <h1>Access Log <span style="color:#8b5cf6;font-size:0.875rem;font-family:monospace;">${escapeHtml(row.id_uuid)}</span></h1>
            <a href="/access-log" class="btn-back">&larr; Kembali</a>
        </div>

        <div class="grid">
            <div class="card">
                <div class="card-title">Request Info</div>
                <div class="info-row"><span class="info-label">Waktu</span><span class="info-value font-mono" style="font-size:0.85rem;">${fmt}</span></div>
                <div class="info-row"><span class="info-label">Method</span><span class="info-value">${methodBadge(row.http_method)}</span></div>
                <div class="info-row"><span class="info-label">Endpoint</span><span class="info-value font-mono" style="font-size:0.85rem;">${escapeHtml(row.endpoint || '-')}</span></div>
                <div class="info-row"><span class="info-label">Client IP</span><span class="info-value font-mono">${escapeHtml(row.client_ip || '-')}</span></div>
                <div class="info-row"><span class="info-label">App Name</span><span class="info-value">${escapeHtml(row.app_name || '-')}</span></div>
                <div class="info-row"><span class="info-label">User Agent</span><span class="info-value text-muted" style="font-size:0.8rem;">${escapeHtml(row.user_agent || '-')}</span></div>
            </div>
            <div class="card">
                <div class="card-title">Response Info</div>
                <div class="info-row"><span class="info-label">Status Code</span><span class="info-value">${statusBadge(row.status_code)}</span></div>
                <div class="info-row"><span class="info-label">Response Time</span><span class="info-value">${timeBadge(row.response_time_ms)}</span></div>
                ${row.error_message ? `<div class="info-row"><span class="info-label">Error</span><span class="info-value error-text">${escapeHtml(row.error_message)}</span></div>` : ''}
            </div>

            <div class="card">
                <div class="card-title">Request Headers</div>
                ${prettyJson(row.request_headers)}
            </div>
            <div class="card">
                <div class="card-title">Query Params</div>
                ${prettyJson(row.query_params)}
            </div>
            <div class="card">
                <div class="card-title">Request Body</div>
                ${prettyJson(row.request_body)}
            </div>
            <div class="card">
                <div class="card-title">Response Body</div>
                ${prettyJson(row.response_body)}
            </div>
        </div>
    </main>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }
}
