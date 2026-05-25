import {
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';

import { Kysely } from 'kysely';

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
            await this.db
                .insertInto(this.tableLog)
                .values(data)
                .execute();
        } catch (err) {
            this.logger.error(err);
        }
    }
}
