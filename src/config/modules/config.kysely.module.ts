// src/database/kysely.module.ts
import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import kyselyConfig from '../kysely.config';

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            load: [kyselyConfig],
            isGlobal: true,
        }),
    ],
    providers: [
        {
            provide: 'KYSELY_CONNECTION',
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => {
                const dbConfig = configService.get('KYSELY_CONFIG');

                const pool = new Pool({
                    host: dbConfig.host,
                    port: dbConfig.port,
                    user: dbConfig.user,
                    password: dbConfig.password,
                    database: dbConfig.database,
                });

                const db = new Kysely<any>({
                    dialect: new PostgresDialect({
                        pool: pool,
                    }),
                    log: (dbConfig.debug?? false)
                        ? (event) => { // Tentukan tipe event sebagai LogEvent
                            // Gunakan event.level untuk switch case
                            switch (event.level) {
                                case 'query':
                                    // event.query ada di level 'query'
                                    console.log(`[Kysely Query] SQL: ${event.query.sql}`);
                                    if (event.query.parameters && event.query.parameters.length > 0) {
                                        console.log(`[Kysely Query] Params: ${JSON.stringify(event.query.parameters)}`);
                                    }
                                    // Gunakan event.queryDurationMillis untuk durasi
                                    console.log(`[Kysely Query] Duration: ${event.queryDurationMillis.toFixed(2)}ms`);
                                    break;
                                case 'error':
                                    // event.query dan event.error ada di level 'error'
                                    console.error(`[Kysely Error] SQL: ${event.query?.sql || 'N/A'}`);
                                    if (event.query.parameters && event.query.parameters.length > 0) {
                                        console.log(`[Kysely Error] Params: ${JSON.stringify(event.query.parameters)}`);
                                    }
                                    break;
                                // Jika Anda menggunakan versi Kysely yang lebih lama yang memiliki level terpisah:
                                // case 'transactionStart': console.log(`[Kysely Transaction] Started`); break;
                                // case 'transactionCommit': console.log(`[Kysely Transaction] Committed`); break;
                                // case 'transactionRollback': console.log(`[Kysely Transaction] Rolled Back`); break;
                                // case 'transactionError': console.error(`[Kysely Transaction] Error`, event.error); break;
                                default:
                                    // Untuk event lain yang mungkin ingin Anda log
                                    // console.log(`[Kysely Event] Level: ${event.level}`, event);
                                    break;
                            }
                        }
                        : undefined,
                });


                try {
                    await sql`SELECT 1`.execute(db);
                    console.log('Kysely connected to database successfully via KYSELY_CONNECTION provider!');
                } catch (e) {
                    console.error('Failed to connect Kysely to database:', e);
                    await pool.end();
                    throw new Error('Database connection failed for KYSELY_CONNECTION.');
                }

                return db;
            },
        },
    ],
    exports: ['KYSELY_CONNECTION'],
})
export class ConfigKyselyModule { }