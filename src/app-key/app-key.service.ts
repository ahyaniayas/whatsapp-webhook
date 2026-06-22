import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class AppKeyService {
    private readonly table = 'sec.s01_app_key';

    @Inject('KYSELY_CONNECTION')
    private readonly db: Kysely<any>;

    async list(params?: { app?: string; mode?: string; is_active?: string }) {
        let query = this.db
            .selectFrom(this.table)
            .select([
                'id',
                'id_uuid',
                'app',
                'key',
                'mode',
                'ips',
                'is_active',
                'created_by',
                'created_at',
                'updated_by',
                'updated_at',
                'updated_note',
            ])
            .where('deleted_at', 'is', null);

        if (params?.app) {
            query = query.where('app', 'ilike', `%${params.app}%`);
        }
        if (params?.mode) {
            query = query.where('mode', '=', params.mode);
        }
        if (params?.is_active) {
            query = query.where('is_active', '=', params.is_active);
        }

        return query.orderBy('id', 'desc').execute();
    }

    async create(data: {
        app: string;
        mode: 'DEV' | 'PROD';
        ips?: string;
        created_by: string;
    }) {
        return this.db
            .insertInto(this.table)
            .values({
                app: data.app,
                key: uuidv7(),
                mode: data.mode,
                ips: data.ips || null,
                is_active: 'Y',
                created_by: data.created_by,
            })
            .execute();
    }

    async update(
        id: number,
        data: {
            mode: 'DEV' | 'PROD';
            ips?: string;
            updated_by: string;
            updated_note?: string;
        },
    ) {
        return this.db
            .updateTable(this.table)
            .set({
                mode: data.mode,
                ips: data.ips || null,
                updated_by: data.updated_by,
                updated_at: new Date(),
                updated_note: data.updated_note || null,
            })
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .execute();
    }

    async regenKey(id: number, updatedBy: string) {
        return this.db
            .updateTable(this.table)
            .set({ key: uuidv7(), updated_by: updatedBy, updated_at: new Date(), updated_note: 'Key diregenerasi via admin panel' })
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .execute();
    }

    async toggleActive(id: number, updatedBy: string) {
        const record = await this.db
            .selectFrom(this.table)
            .select(['id', 'is_active'])
            .where('id', '=', id)
            .where('deleted_at', 'is', null)
            .executeTakeFirst();
        if (!record) return;
        const newActive = record.is_active === 'Y' ? 'N' : 'Y';
        return this.db
            .updateTable(this.table)
            .set({ is_active: newActive, updated_by: updatedBy, updated_at: new Date() })
            .where('id', '=', id)
            .execute();
    }

    async softDelete(id: number, deletedBy: string) {
        return this.db
            .updateTable(this.table)
            .set({ deleted_at: new Date(), deleted_by: deletedBy, is_active: 'N' })
            .where('id', '=', id)
            .execute();
    }
}
