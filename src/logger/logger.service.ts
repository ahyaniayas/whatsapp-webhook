import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';

import { Kysely, sql } from 'kysely';

@Injectable()
export class LoggerService {
    @Inject('KYSELY_CONNECTION')
    private readonly db: Kysely<any>;

    private readonly logger = new Logger(
        LoggerService.name,
    );

    private readonly tableLog =
        'logger.l01_wa_webhook_log';

    async insertWebhookLog(data: any) {
        try {
            const result = await this.db
                .insertInto(this.tableLog)
                .values(data)
                .returningAll()
                .execute();

            if (!result || result.length == 0) {
                throw new Error('Failed to insert webhook log. No data returned.');
            }
            return result[0];
        } catch (err) {
            this.logger.error(err);
        }
    }

    async list(params: { waMessageId?: string; from?: string; to?: string; status?: string; app: string; dateFrom?: string; dateTo?: string; limit?: number }) {
        let query = this.db
            .selectFrom(`${this.tableLog} as log`)
            .select([
                'log.wa_message_id',
                // Mengambil nomor pengirim dan penerima yang paling valid/terakhir muncul
                sql<string>`max(log.from_number)`.as('from_number'),
                sql<string>`max(log.to_number)`.as('to_number'),

                // Menggabungkan seluruh riwayat tipe dan status ke dalam satu array JSON kronologis
                sql<any[]>`
                    json_agg(
                        json_build_object(
                            'id', log.id,
                            'app', log.app,
                            'message_type', log.message_type,
                            'status', log.message_status,
                            'error_title', log.error_title,
                            'pricing_billable', log.pricing_billable,
                            'created_at', to_char(log.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
                        ) order by log.id desc
                    )
                `.as('statuses'),
                sql<string>`max(log.created_at)`.as('created_at'),
            ])
            .groupBy('log.wa_message_id'); // Murni grouping berdasarkan 1 Message ID saja

        // Di dalam method list() milik LoggerService:
        if (params.app) {
            query = query.where('log.app', '=', params.app);
        }

        // Tambahkan potongan filter ini di dalam logger.service.ts Anda
        if (params.waMessageId) {
            query = query.where('log.wa_message_id', '=', params.waMessageId);
        }

        // filter from
        if (params.from) {
            query = query.where('log.from_number', 'ilike', `%${params.from}%`);
        }

        // filter to
        if (params.to) {
            query = query.where('log.to_number', 'ilike', `%${params.to}%`);
        }

        // filter tanggal dari
        if (params.dateFrom) {
            query = query.where('log.created_at', '>=', new Date(params.dateFrom));
        }

        // filter tanggal sampai
        if (params.dateTo) {
            const end = new Date(params.dateTo);
            end.setDate(end.getDate() + 1);
            query = query.where('log.created_at', '<', end);
        }

        // filter status: data muncul jika salah satu riwayat log mengandung status yang dicari
        if (params.status) {
            query = query.where('log.wa_message_id', 'in', (eb) => {
                let subQuery = eb.selectFrom(this.tableLog).select('wa_message_id');
                if (params.status === 'null') {
                    return subQuery.where('message_status', 'is', null);
                } else {
                    return subQuery.where('message_status', '=', params.status);
                }
            });
        }

        // limit
        let limit = Number(params.limit) || 100;

        return query.orderBy(sql`max(log.id)`, 'desc').limit(limit).execute();
    }

    async findAppByMessageId(waMessageId: string): Promise<string | null> {
        const row = await this.db
            .selectFrom(this.tableLog)
            .select('app')
            .where('wa_message_id', '=', waMessageId)
            .where('app', 'is not', null)
            .orderBy('id', 'asc')
            .executeTakeFirst();

        return row?.app ?? null;
    }

    async detail(
        waMessageId: string,
    ) {
        return this.db
            .selectFrom(this.tableLog)
            .selectAll()
            .where('wa_message_id', '=', waMessageId)
            .orderBy('id', 'desc')
            .execute();
    }
}
