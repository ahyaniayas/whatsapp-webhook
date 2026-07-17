import { Body, Controller, Get, Post, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { MfaService } from 'src/mfa/mfa.service';
import type { Request, Response } from 'express';

@Controller()
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly mfaService: MfaService,
    ) {}

    private getIp(req: Request): string {
        const raw = req.ip || '';
        if (raw === '::1') return '127.0.0.1';
        return raw.replace(/^::ffff:/, '').replace(/\s+/g, '');
    }

    @Get('login')
    loginPage(@Req() req: Request, @Res() res: Response) {
        const error = req.query.error as string;
        const remaining = parseInt(req.query.remaining as string) || 0;
        const waitSeconds = parseInt(req.query.wait as string) || 0;

        const isLocked = error === 'locked' && waitSeconds > 0;
        const isWrongCred = error === '1';

        let alertHtml = '';
        if (isLocked) {
            alertHtml = `
            <div class="alert alert-locked">
                <div class="alert-icon">🔒</div>
                <div>
                    <strong>Terlalu banyak percobaan gagal.</strong><br>
                    Coba lagi dalam <span id="countdown">${waitSeconds}</span> detik.
                </div>
            </div>`;
        } else if (isWrongCred) {
            const remainingHtml = remaining > 0
                ? `<br><span style="font-size:0.8rem;opacity:0.85;">Sisa percobaan: <strong>${remaining}</strong></span>`
                : '';
            alertHtml = `<div class="alert alert-error">&#9888; Username atau password salah.${remainingHtml}</div>`;
        }

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - WhatsApp Admin</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #f1f5f9; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 1rem; }
        .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 2.5rem; width: 100%; max-width: 400px; }
        .logo { text-align: center; margin-bottom: 2rem; }
        .logo-circle { width: 60px; height: 60px; background: linear-gradient(135deg, #10b981, #059669); border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem; font-size: 1.75rem; }
        h1 { font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-bottom: 0.25rem; }
        .subtitle { font-size: 0.875rem; color: #64748b; }
        .alert { padding: 0.875rem 1rem; border-radius: 8px; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5; }
        .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #dc2626; }
        .alert-locked { background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; display: flex; gap: 0.75rem; align-items: flex-start; }
        .alert-icon { font-size: 1.25rem; line-height: 1; flex-shrink: 0; }
        .form-group { margin-bottom: 1.125rem; }
        label { display: block; font-size: 0.75rem; font-weight: 600; color: #475569; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.375rem; }
        input[type="text"], input[type="password"] { width: 100%; padding: 0.75rem 1rem; border: 1.5px solid #e2e8f0; border-radius: 8px; font-size: 0.9375rem; color: #0f172a; outline: none; transition: all 0.2s; }
        input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.12); }
        input:disabled { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
        input::placeholder { color: #94a3b8; }
        .btn { width: 100%; padding: 0.8125rem; background: #10b981; color: white; border: none; border-radius: 8px; font-size: 0.9375rem; font-weight: 600; cursor: pointer; transition: background 0.2s; margin-top: 0.5rem; }
        .btn:hover:not(:disabled) { background: #059669; }
        .btn:disabled { background: #94a3b8; cursor: not-allowed; }
    </style>
</head>
<body>
    <div class="card">
        <div class="logo">
            <div class="logo-circle">📱</div>
            <h1>WhatsApp Admin</h1>
            <p class="subtitle">Masuk ke panel administrasi</p>
        </div>
        ${alertHtml}
        <form method="POST" action="/login" id="loginForm">
            <div class="form-group">
                <label for="username">Username</label>
                <input type="text" id="username" name="username" placeholder="Masukkan username" required autocomplete="username" ${isLocked ? 'disabled' : ''} />
            </div>
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" placeholder="Masukkan password" required autocomplete="current-password" ${isLocked ? 'disabled' : ''} />
            </div>
            <button type="submit" class="btn" id="submitBtn" ${isLocked ? 'disabled' : ''}>Masuk</button>
        </form>
        <a href="/mfa/start" style="display:block; text-align:center; margin-top:1.125rem; font-size:0.8125rem; color:#059669; font-weight:600; text-decoration:none;">Masuk dengan WhatsApp</a>
    </div>
    <script>
        const wait = ${waitSeconds};
        if (wait > 0) {
            let secs = wait;
            const countEl = document.getElementById('countdown');
            const tick = setInterval(() => {
                secs--;
                if (countEl) countEl.textContent = secs;
                if (secs <= 0) {
                    clearInterval(tick);
                    window.location.replace('/login');
                }
            }, 1000);
        }
    </script>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        return res.send(html);
    }

    @Post('login')
    loginAction(
        @Body() body: { username: string; password: string },
        @Req() req: Request,
        @Res() res: Response,
    ) {
        const ip = this.getIp(req);

        const lock = this.authService.checkLock(ip);
        if (lock.locked) {
            return res.redirect(`/login?error=locked&wait=${lock.remainingSeconds}`);
        }

        if (this.authService.validate(body.username, body.password)) {
            this.authService.resetAttempts(ip);
            const session = this.mfaService.createPendingSession(body.username);
            res.cookie('_mfa_pending', session.sessionId, {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                maxAge: 10 * 60 * 1000,
            });
            return res.redirect('/mfa/verify');
        }

        const result = this.authService.recordFailure(ip);
        if (result.locked) {
            const recheck = this.authService.checkLock(ip);
            return res.redirect(`/login?error=locked&wait=${recheck.remainingSeconds}`);
        }

        return res.redirect(`/login?error=1&remaining=${result.remainingAttempts}`);
    }

    @Get('logout')
    logout(@Res() res: Response) {
        res.clearCookie('_wa_admin', { path: '/' });
        return res.redirect('/login');
    }
}
