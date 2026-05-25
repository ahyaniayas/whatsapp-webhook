import { Inject, Injectable, Logger } from '@nestjs/common';
import { Kysely } from 'kysely';
import { LoggerService } from 'src/logger/logger.service';

@Injectable()
export class WhatsappService {
    @Inject('KYSELY_CONNECTION')
    private readonly db: Kysely<any>;
    private readonly logger = new Logger(WhatsappService.name);

    private tableLog: string = 'logger.l01_wa_webhook_log';

    constructor(
        private readonly loggerService: LoggerService,
    ) { }

    async handleWebhook(body: any) {
        try {
            const entry = body?.entry?.[0];
            const changes = entry?.changes?.[0];

            const value = changes?.value;

            const messages = value?.messages;
            const statuses = value?.statuses;

            if (messages?.length) {
                for (const msg of messages) {
                    await this.handleIncomingMessage(
                        msg,
                        value,
                        body,
                        changes,
                    );
                }
            }

            if (statuses?.length) {
                for (const status of statuses) {
                    await this.handleMessageStatus(
                        status,
                        value,
                        body,
                        changes,
                    );
                }
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    private async handleIncomingMessage(
        message: any,
        value: any,
        rawBody: any,
        changes: any,
    ) {
        const from = message.from;
        const type = message.type;

        this.logger.log(`Incoming message from ${from}`);

        await this.loggerService.insertWebhookLog({
            webhook_object: rawBody?.object,
            webhook_field: changes?.field,

            wa_message_id: message.id,

            from_number: from,
            to_number: value?.metadata?.display_phone_number,

            message_type: type,

            message_text: message?.text?.body,

            media_id:
                message?.document?.id ||
                message?.image?.id,

            media_filename:
                message?.document?.filename,

            media_mime_type:
                message?.document?.mime_type ||
                message?.image?.mime_type,

            wa_timestamp: Number(message?.timestamp),

            raw_json: JSON.stringify(message),
        });
    }

    private async handleMessageStatus(
        status: any,
        value: any,
        rawBody: any,
        changes: any,
    ) {
        this.logger.log(
            `Message ${status.id} status ${status.status}`,
        );

        const error = status?.errors?.[0];

        await this.loggerService.insertWebhookLog({
            webhook_object: rawBody?.object,
            webhook_field: changes?.field,

            wa_message_id: status.id,

            to_number: status.recipient_id,

            message_status: status.status,

            pricing_model: status?.pricing?.pricing_model,
            pricing_category: status?.pricing?.category,
            pricing_billable: status?.pricing?.billable,

            error_code: error?.code?.toString(),
            error_title: error?.title,
            error_message: error?.message,

            wa_timestamp: Number(status?.timestamp),

            raw_json: JSON.stringify(status),
        });
    }
}
