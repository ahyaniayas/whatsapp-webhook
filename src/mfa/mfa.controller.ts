import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { MfaService } from './mfa.service';
import { AuthService } from 'src/auth/auth.service';

@Controller('mfa')
export class MfaController {
    constructor(
        private readonly mfaService: MfaService,
        private readonly authService: AuthService,
    ) {}

    private issueSessionCookie(res: Response, username: string): void {
        const token = this.authService.createToken(username);
        res.cookie('_wa_admin', token, { httpOnly: true, sameSite: 'lax', path: '/' });
        res.clearCookie('_mfa_pending', { path: '/' });
    }

    /**
     * Shortcut "Masuk dengan WhatsApp" dari halaman login: langsung ke halaman OTP
     * tanpa username/password. Identitas WA (ADMIN_NUMBERS) sendiri yang jadi faktor login di jalur ini.
     */
    @Get('start')
    start(@Res() res: Response) {
        const session = this.mfaService.createPendingSession(process.env.ADMIN_USERNAME || '');
        res.cookie('_mfa_pending', session.sessionId, {
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 10 * 60 * 1000,
        });
        return res.redirect('/mfa/verify');
    }

    @Get('verify')
    verifyPage(@Req() req: Request, @Res() res: Response) {
        const sessionId = (req.cookies as Record<string, string>)?._mfa_pending;
        const session = this.mfaService.getSession(sessionId);

        if (!session) {
            return res.redirect('/login?error=mfa_expired');
        }

        const waLink = this.mfaService.buildWaMeLink(session.otpCode);

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verifikasi WhatsApp - WhatsApp Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
        .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 2.5rem; width: 100%; max-width: 400px; text-align: center; }
        .logo-circle { width: 60px; height: 60px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem; font-size: 1.75rem; }
        h1 { font-size: 1.375rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
        p { font-size: 0.875rem; color: #64748b; line-height: 1.5; margin-bottom: 1.5rem; }
        .btn { display: inline-block; width: 100%; padding: 0.8125rem; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 0.9375rem; font-weight: 600; cursor: pointer; text-decoration: none; }
        .btn:hover { background: #059669; }
        .status { margin-top: 1.25rem; font-size: 0.8125rem; color: #94a3b8; }
        .expired { display: none; margin-top: 1.25rem; font-size: 0.875rem; color: #dc2626; }
        .expired a { color: #059669; font-weight: 600; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo-circle">📲</div>
        <h1>Verifikasi via WhatsApp</h1>
        <p>Ketuk tombol di bawah untuk membuka WhatsApp, lalu kirim langsung pesan yang sudah terisi otomatis ke nomor admin.<br><strong>Jangan ubah isi pesannya</strong> — cukup tekan tombol kirim di WhatsApp.</p>
        <a class="btn" id="waBtn" href="${waLink}" target="_blank" rel="noopener">Buka WhatsApp</a>
        <div class="status" id="statusText">Menunggu balasan WhatsApp...</div>
        <div class="expired" id="expiredText">Sesi kedaluwarsa. <a href="/login">Login ulang</a></div>
    </div>
    <script>
        const poll = setInterval(async () => {
            try {
                const res = await fetch('/mfa/status');
                const data = await res.json();
                if (data.status === 'confirmed') {
                    clearInterval(poll);
                    window.location.href = data.redirect || '/dashboard';
                } else if (data.status === 'not_found') {
                    clearInterval(poll);
                    document.getElementById('statusText').style.display = 'none';
                    document.getElementById('waBtn').style.display = 'none';
                    document.getElementById('expiredText').style.display = 'block';
                }
            } catch {}
        }, 3000);
    </script>
</body>
</html>`;

        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    @Get('status')
    status(@Req() req: Request, @Res() res: Response) {
        const sessionId = (req.cookies as Record<string, string>)?._mfa_pending;
        const result = this.mfaService.getStatusForPolling(sessionId);

        if (result.status === 'not_found') {
            res.clearCookie('_mfa_pending', { path: '/' });
            return res.json(result);
        }

        if (result.status === 'confirmed' && result.username) {
            this.issueSessionCookie(res, result.username);
            return res.json({ status: 'confirmed', redirect: '/dashboard' });
        }

        return res.json(result);
    }

    @Get('confirm')
    confirm(@Query('token') token: string, @Res() res: Response) {
        const session = this.mfaService.confirmByToken(token);
        if (!session) {
            return res.redirect('/login?error=mfa_expired');
        }

        this.issueSessionCookie(res, session.username);
        return res.redirect('/dashboard');
    }
}
