export interface WaPhoneNumber {
    id: string;
    phone: string;
}

/**
 * Daftar nomor pengirim WA yang terdaftar di Business Account, dikonfigurasi via
 * env WA_PHONE_NUMBERS berisi JSON array, contoh:
 * WA_PHONE_NUMBERS=[{"phone":"+6281234567890","id":"1234567890"}]
 */
export function getWaPhoneNumbers(): WaPhoneNumber[] {
    const raw = process.env.WA_PHONE_NUMBERS;
    if (!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry) => entry?.id && entry?.phone);
    } catch {
        return [];
    }
}
