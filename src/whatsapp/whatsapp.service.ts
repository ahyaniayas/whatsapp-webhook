import { Inject, Injectable, Logger } from '@nestjs/common';
import { Kysely } from 'kysely';

@Injectable()
export class WhatsappService {
    @Inject("KYSELY_CONNECTION") private readonly db: Kysely<any>;
    private readonly logger = new Logger(WhatsappService.name);

    async handleWebhook(body: any) {
        try {
            const entry = body?.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value;

            // pesan masuk
            const messages = value?.messages;

            // status pesan
            const statuses = value?.statuses;

            if (messages?.length) {
                for (const msg of messages) {
                    await this.handleIncomingMessage(msg, value);
                }
            }

            if (statuses?.length) {
                for (const status of statuses) {
                    await this.handleMessageStatus(status);
                }
            }
        } catch (err) {
            this.logger.error(err);
        }
    }

    private async handleIncomingMessage(message: any, value: any) {
        const from = message.from;
        const type = message.type;

        this.logger.log(`Incoming message from ${from}`);

        switch (type) {
            case 'text':
                console.log({
                    from,
                    text: message.text?.body,
                });
                break;

            case 'image':
                console.log({
                    from,
                    imageId: message.image?.id,
                });
                break;

            case 'document':
                console.log({
                    from,
                    documentId: message.document?.id,
                    filename: message.document?.filename,
                });
                break;

            default:
                console.log({
                    from,
                    type,
                });
                break;
        }
    }

    private async handleMessageStatus(status: any) {
        console.log(
            'MESSAGE STATUS::',
            JSON.stringify({
                messageId: status.id,
                recipient: status.recipient_id,
                status: status.status,
                timestamp: status.timestamp,

                conversation: status.conversation,
                pricing: status.pricing,
                errors: status.errors,

                raw: status,
            }),
        );
    }
}
