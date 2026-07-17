import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { v7 as uuidv7 } from 'uuid';
import { WaApiService } from 'src/api/v1/wa-api/wa-api.service';
import { getWaPhoneNumbers } from 'src/shared/wa-phone-numbers.util';

type MfaStatus = 'PENDING_WA' | 'PENDING_CLICK' | 'CONFIRMED';

interface PendingMfaSession {
    sessionId: string;
    username: string;
    otpCode: string;
    magicToken: string | null;
    status: MfaStatus;
    expiresAt: number;
}

@Injectable()
export class MfaService {
    private readonly logger = new Logger(MfaService.name);

    private readonly appBaseUrl =
        process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    private readonly waPendingTtlMs = 5 * 60 * 1000; // menunggu balasan WA
    private readonly clickPendingTtlMs = 5 * 60 * 1000; // menunggu klik link OTP

    private readonly sessions = new Map<string, PendingMfaSession>();

    constructor(private readonly waApiService: WaApiService) {}

    private getAdminNumbers(): string[] {
        try {
            const parsed = JSON.parse(process.env.ADMIN_NUMBERS || '[]');
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter((n) => typeof n === 'string' && n.length > 0)
                .map((n) => this.waApiService.normalizePhone(n));
        } catch {
            return [];
        }
    }

    private pruneExpired(): void {
        const now = Date.now();
        for (const [id, session] of this.sessions) {
            if (session.expiresAt < now) {
                this.sessions.delete(id);
            }
        }
    }

    createPendingSession(username: string): PendingMfaSession {
        this.pruneExpired();

        const session: PendingMfaSession = {
            sessionId: uuidv7(),
            username,
            otpCode: String(crypto.randomInt(100000, 999999)),
            magicToken: null,
            status: 'PENDING_WA',
            expiresAt: Date.now() + this.waPendingTtlMs,
        };

        this.sessions.set(session.sessionId, session);
        return session;
    }

    getSession(sessionId: string | undefined): PendingMfaSession | null {
        if (!sessionId) return null;
        const session = this.sessions.get(sessionId);
        if (!session) return null;
        if (session.expiresAt < Date.now()) {
            this.sessions.delete(sessionId);
            return null;
        }
        return session;
    }

    private findByCode(code: string): PendingMfaSession | null {
        const now = Date.now();
        for (const session of this.sessions.values()) {
            if (session.status === 'PENDING_WA' && session.otpCode === code) {
                if (session.expiresAt < now) return null;
                return session;
            }
        }
        return null;
    }

    private findByMagicToken(token: string): PendingMfaSession | null {
        const now = Date.now();
        for (const session of this.sessions.values()) {
            if (session.status === 'PENDING_CLICK' && session.magicToken === token) {
                if (session.expiresAt < now) return null;
                return session;
            }
        }
        return null;
    }

    buildWaMeLink(otpCode: string): string {
        const target = this.waApiService.normalizePhone(process.env.ADMIN_MAIN_NUMBER || '');
        const message =
            `Halo, saya ingin masuk ke Dashboard Admin.\n` +
            `Kode verifikasi saya: ${otpCode}\n` +
            `Mohon jangan ubah isi pesan ini, langsung tekan kirim ya. Terima kasih.`;
        return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
    }

    getStatusForPolling(
        sessionId: string | undefined,
    ): { status: 'not_found' | 'pending' | 'confirmed'; username?: string } {
        const session = this.getSession(sessionId);
        if (!session) return { status: 'not_found' };
        if (session.status === 'CONFIRMED') return { status: 'confirmed', username: session.username };
        return { status: 'pending' };
    }

    confirmByToken(token: string): PendingMfaSession | null {
        const session = this.findByMagicToken(token);
        if (!session) return null;
        session.status = 'CONFIRMED';
        return session;
    }

    /**
     * Dipanggil dari webhook WA setiap ada pesan masuk bertipe text.
     * Diam-diam abaikan (tanpa balasan) jika pengirim tidak di-allowlist atau kode tidak cocok,
     * supaya tidak memberi sinyal ke nomor yang bukan admin.
     */
    async handleInboundReply(from: string | undefined, text: string | undefined): Promise<void> {
        if (!from || !text) return;

        const normalizedFrom = this.waApiService.normalizePhone(from);
        if (!this.getAdminNumbers().includes(normalizedFrom)) return;

        const match = text.match(/\b(\d{6})\b/);
        if (!match) return;

        const session = this.findByCode(match[1]);
        if (!session) return;

        const magicToken = crypto.randomBytes(32).toString('base64url');
        const previousExpiresAt = session.expiresAt;
        session.magicToken = magicToken;
        session.status = 'PENDING_CLICK';
        session.expiresAt = Date.now() + this.clickPendingTtlMs;

        const waPhoneId = getWaPhoneNumbers().find(
            (p) => this.waApiService.normalizePhone(p.phone) === this.waApiService.normalizePhone(process.env.ADMIN_MAIN_NUMBER || ''),
        )?.id;

        if (!waPhoneId) {
            this.logger.error('ADMIN_MAIN_NUMBER tidak ditemukan di WA_PHONE_NUMBERS, tidak bisa kirim link OTP');
            session.status = 'PENDING_WA';
            session.magicToken = null;
            session.expiresAt = previousExpiresAt;
            return;
        }

        const magicLink = `${this.appBaseUrl}/mfa/confirm?token=${magicToken}`;

        try {
            await this.waApiService.sendText({
                to: from,
                waPhoneId,
                body: `Berikut link untuk menyelesaikan login Anda:\n${magicLink}\n\nLink berlaku 5 menit.`,
            });
        } catch (err) {
            this.logger.error(`Gagal mengirim link OTP: ${err?.message}`, err?.stack);
            session.status = 'PENDING_WA';
            session.magicToken = null;
            session.expiresAt = previousExpiresAt;
        }
    }
}
