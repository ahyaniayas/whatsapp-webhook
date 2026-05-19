import { registerAs } from "@nestjs/config";

export default registerAs(
    "KYSELY_CONFIG",
    () => ({
        host: process.env.DB_HOST,
        port: +(process.env.DB_PORT || 5432),
        user: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        debug: process.env.APP_ENV === "DEVELOPMENT",
    }),
)