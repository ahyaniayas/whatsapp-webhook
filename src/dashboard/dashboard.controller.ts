import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { navBar } from '../shared/html.util';
import type { Response } from 'express';

@Controller('dashboard')
@UseGuards(AuthGuard)
export class DashboardController {
    @Get()
    index(@Res() res: Response) {
        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - WhatsApp Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f8fafc; color: #1e293b; }
        main { padding: 2rem; }
        .page-title { font-size: 1.75rem; font-weight: 700; color: #0f172a; margin-bottom: 0.375rem; }
        .page-subtitle { font-size: 0.9375rem; color: #64748b; margin-bottom: 2rem; }
        .cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
        .card { background: white; border-radius: 14px; border: 1px solid #e2e8f0; padding: 1.75rem; text-decoration: none; color: inherit; display: flex; flex-direction: column; gap: 1rem; transition: box-shadow 0.2s, transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
        .card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .card-icon { width: 52px; height: 52px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .card-icon.green { background: #f0fdf4; }
        .card-icon.indigo { background: #eef2ff; }
        .card-icon.amber { background: #fffbeb; }
        .card-icon.violet { background: #f5f3ff; }
        .card-title { font-size: 1.125rem; font-weight: 700; color: #0f172a; }
        .card-desc { font-size: 0.875rem; color: #64748b; line-height: 1.6; }
        .card-link { margin-top: auto; display: inline-flex; align-items: center; gap: 0.375rem; font-size: 0.875rem; font-weight: 600; }
        .card-link.green { color: #10b981; }
        .card-link.indigo { color: #6366f1; }
        .card-link.amber { color: #f59e0b; }
        .card-link.violet { color: #8b5cf6; }
    </style>
</head>
<body>
    ${navBar('dashboard')}
    <main>
        <div class="page-title">Dashboard</div>
        <div class="page-subtitle">Selamat datang di panel administrasi WhatsApp Gateway</div>
        <div class="cards">
            <a href="/api/v1/wa-api/queue" class="card">
                <div class="card-icon green">📋</div>
                <div>
                    <div class="card-title">Queue Monitor</div>
                    <div class="card-desc">Pantau dan filter antrean pengiriman pesan WhatsApp beserta statusnya (WAITING, PROCESSING, SUCCESS, FAILED).</div>
                </div>
                <div class="card-link green">Buka Queue &rarr;</div>
            </a>
            <a href="/logger" class="card">
                <div class="card-icon indigo">📝</div>
                <div>
                    <div class="card-title">Logger</div>
                    <div class="card-desc">Lihat log webhook pesan WhatsApp termasuk status pengiriman, riwayat status, dan detail pesan.</div>
                </div>
                <div class="card-link indigo">Buka Logger &rarr;</div>
            </a>
            <a href="/app-keys" class="card">
                <div class="card-icon amber">🔑</div>
                <div>
                    <div class="card-title">App Key Management</div>
                    <div class="card-desc">Kelola API key dan whitelist IP address untuk setiap aplikasi klien yang mengakses gateway ini.</div>
                </div>
                <div class="card-link amber">Kelola App Keys &rarr;</div>
            </a>
            <a href="/access-log" class="card">
                <div class="card-icon violet">📊</div>
                <div>
                    <div class="card-title">Access Log</div>
                    <div class="card-desc">Pantau setiap request HTTP yang masuk: endpoint, method, status, response time, dan body request/response.</div>
                </div>
                <div class="card-link violet">Buka Access Log &rarr;</div>
            </a>
        </div>
    </main>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }
}
