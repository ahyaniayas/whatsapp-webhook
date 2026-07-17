import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { Kysely } from 'kysely';
import { AuthService } from 'src/auth/auth.service';

const SKIP_PATHS = new Set(['/favicon.svg', '/api/v1/wa-api/health']);
const SKIP_PREFIXES = ['/access-log', '/logger'];

const SENSITIVE_BODY_KEYS = new Set([
    'password', 'token', 'key', 'secret', 'api_key',
    'file', 'file_base64', 'fileBase64',
]);

const SENSITIVE_HEADER_KEYS = new Set([
    'cookie', 'authorization', 'api-key', 'app-key',
]);

@Injectable()
export class AccessLogMiddleware implements NestMiddleware {
    private readonly table = 'logger.l02_access_log';
    private readonly tableAppKey = 'sec.s01_app_key';

    constructor(
        @Inject('KYSELY_CONNECTION') private readonly db: Kysely<any>,
        private readonly authService: AuthService,
    ) { }

    use(req: Request, res: Response, next: NextFunction): void {
        const path = req.originalUrl.split('?')[0];
        if (SKIP_PATHS.has(path) || SKIP_PREFIXES.some(p => path.startsWith(p))) {
            return next();
        }

        const startMs = Date.now();
        let capturedJsonBody: any = null;

        const originalJson = res.json.bind(res);
        res.json = (body: any) => {
            capturedJsonBody = body;
            return originalJson(body);
        };

        res.on('finish', () => {
            this.insertLog(req, res, Date.now() - startMs, capturedJsonBody).catch(() => { });
        });

        next();
    }

    private getIp(req: Request): string {
        const raw = req.ip || '';
        if (raw === '::1') return '127.0.0.1';
        return raw.replace(/^::ffff:/, '').trim();
    }

    private getUser(req: Request): string | null {
        try {
            const token = (req.cookies as Record<string, string>)?._wa_admin;
            return token ? this.authService.verifyToken(token) : null;
        } catch {
            return null;
        }
    }

    private async getAppName(req: Request): Promise<string | null> {
        const appKey = req.headers['app-key'] as string;
        if (!appKey) return null;

        const row = await this.db
            .selectFrom(this.tableAppKey)
            .select('app')
            .where('key', '=', appKey)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();

        return row?.app ?? null;
    }

    private sanitizeBody(body: any): Record<string, any> | null {
        if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(body)) {
            result[k] = SENSITIVE_BODY_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
        }
        return result;
    }

    private sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(headers)) {
            result[k] = SENSITIVE_HEADER_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
        }
        return result;
    }

    private sanitizeQuery(query: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [k, v] of Object.entries(query)) {
            result[k] = SENSITIVE_BODY_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
        }
        return result;
    }

    private sanitizeEndpoint(req: Request): string {
        const [path, queryString] = (req.originalUrl || req.path).split('?');
        if (!queryString) return path;

        const params = new URLSearchParams(queryString);
        for (const key of params.keys()) {
            if (SENSITIVE_BODY_KEYS.has(key.toLowerCase())) {
                params.set(key, '[REDACTED]');
            }
        }
        return `${path}?${params.toString()}`;
    }

    private async insertLog(req: Request, res: Response, responseTimeMs: number, responseBody: any): Promise<void> {
        try {
            const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data');

            const sanitizedBody = isMultipart ? null : this.sanitizeBody(req.body);
            const sanitizedHeaders = this.sanitizeHeaders(req.headers as Record<string, any>);
            const queryParams = Object.keys(req.query).length > 0
                ? this.sanitizeQuery(req.query as Record<string, any>)
                : null;

            const statusCode = res.statusCode;

            let errorMessage: string | null = null;
            if (statusCode >= 400 && responseBody) {
                const msg = responseBody.message;
                errorMessage = msg ? (typeof msg === 'string' ? msg : JSON.stringify(msg)) : null;
            }

            await this.db.insertInto(this.table).values({
                app_name: await this.getAppName(req),
                client_ip: this.getIp(req),
                user_agent: (req.headers['user-agent'] as string) || null,
                http_method: req.method,
                endpoint: this.sanitizeEndpoint(req),
                request_headers: JSON.stringify(sanitizedHeaders),
                query_params: queryParams ? JSON.stringify(queryParams) : null,
                request_body: sanitizedBody ? JSON.stringify(sanitizedBody) : null,
                status_code: statusCode,
                response_time_ms: responseTimeMs,
                response_body: responseBody ? JSON.stringify(responseBody) : null,
                error_message: errorMessage,
                created_by: this.getUser(req),
            }).execute();
        } catch {
            // Jangan biarkan error logging mengganggu request utama
        }
    }
}
