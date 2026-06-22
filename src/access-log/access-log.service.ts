import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';

const STATUS_RANGES: Record<string, [number, number]> = {
    '2xx': [200, 299],
    '3xx': [300, 399],
    '4xx': [400, 499],
    '5xx': [500, 599],
};

@Injectable()
export class AccessLogService {
    private readonly table = 'logger.l02_access_log';

    @Inject('KYSELY_CONNECTION')
    private readonly db: Kysely<any>;

    async list(params: {
        appName?: string;
        clientIp?: string;
        method?: string;
        statusGroup?: string;
        endpoint?: string;
        dateFrom?: string;
        dateTo?: string;
        limit?: number;
    }) {
        let query = this.db
            .selectFrom(`${this.table} as l`)
            .select([
                'l.id',
                'l.id_uuid',
                'l.created_at',
                'l.app_name',
                'l.client_ip',
                'l.http_method',
                'l.endpoint',
                'l.status_code',
                'l.response_time_ms',
                'l.error_message',
                'l.created_by',
            ])
            .where('l.deleted_at', 'is', null);

        if (params.appName) {
            query = query.where('l.app_name', 'ilike', `%${params.appName}%`);
        }
        if (params.clientIp) {
            query = query.where('l.client_ip', 'ilike', `%${params.clientIp}%`);
        }
        if (params.method) {
            query = query.where('l.http_method', '=', params.method.toUpperCase());
        }
        if (params.endpoint) {
            query = query.where('l.endpoint', 'ilike', `%${params.endpoint}%`);
        }
        if (params.statusGroup) {
            const range = STATUS_RANGES[params.statusGroup];
            if (range) {
                query = query
                    .where('l.status_code', '>=', range[0])
                    .where('l.status_code', '<=', range[1]);
            }
        }
        if (params.dateFrom) {
            query = query.where('l.created_at', '>=', new Date(params.dateFrom));
        }
        if (params.dateTo) {
            const end = new Date(params.dateTo);
            end.setDate(end.getDate() + 1);
            query = query.where('l.created_at', '<', end);
        }

        const limit = Math.min(Number(params.limit) || 100, 500);

        return query.orderBy('l.id', 'desc').limit(limit).execute();
    }

    async detail(idUuid: string) {
        return this.db
            .selectFrom(this.table)
            .selectAll()
            .where('id_uuid', '=', idUuid)
            .executeTakeFirst();
    }
}
