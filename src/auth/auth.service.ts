import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface AttemptEntry {
    count: number;
    lockedUntil: number;
}

@Injectable()
export class AuthService {
    private readonly username = process.env.ADMIN_USERNAME || '';
    private readonly password = process.env.ADMIN_PASSWORD || '';
    private readonly secret = process.env.SESSION_SECRET || 'wa-admin-secret-change-me';
    private readonly tokenTtlMs = 8 * 60 * 60 * 1000; // 8 hours

    private readonly maxAttempts = 3;
    private readonly lockDurationMs = 30_000; // 30 seconds
    private readonly attempts = new Map<string, AttemptEntry>();

    validate(username: string, password: string): boolean {
        return username === this.username && password === this.password;
    }

    checkLock(ip: string): { locked: boolean; remainingSeconds: number } {
        const entry = this.attempts.get(ip);
        if (!entry?.lockedUntil) return { locked: false, remainingSeconds: 0 };

        const remaining = entry.lockedUntil - Date.now();
        if (remaining <= 0) {
            this.attempts.delete(ip);
            return { locked: false, remainingSeconds: 0 };
        }
        return { locked: true, remainingSeconds: Math.ceil(remaining / 1000) };
    }

    recordFailure(ip: string): { locked: boolean; remainingAttempts: number } {
        const entry = this.attempts.get(ip) ?? { count: 0, lockedUntil: 0 };
        entry.count += 1;

        if (entry.count >= this.maxAttempts) {
            entry.lockedUntil = Date.now() + this.lockDurationMs;
            this.attempts.set(ip, entry);
            return { locked: true, remainingAttempts: 0 };
        }

        this.attempts.set(ip, entry);
        return { locked: false, remainingAttempts: this.maxAttempts - entry.count };
    }

    resetAttempts(ip: string): void {
        this.attempts.delete(ip);
    }

    createToken(username: string): string {
        const payload = JSON.stringify({ u: username, t: Date.now() });
        const b64 = Buffer.from(payload).toString('base64url');
        const sig = crypto.createHmac('sha256', this.secret).update(b64).digest('hex');
        return `${b64}.${sig}`;
    }

    verifyToken(token: string): string | null {
        try {
            const dotIdx = token.lastIndexOf('.');
            if (dotIdx === -1) return null;
            const b64 = token.substring(0, dotIdx);
            const sig = token.substring(dotIdx + 1);
            const expected = crypto.createHmac('sha256', this.secret).update(b64).digest('hex');
            if (sig !== expected) return null;
            const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
            if (Date.now() - payload.t > this.tokenTtlMs) return null;
            return payload.u || null;
        } catch {
            return null;
        }
    }
}
