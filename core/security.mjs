const enc = new TextEncoder();
export async function digest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(text)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function hashPassword(password, salt = crypto.randomUUID()) {
    const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
    return salt + ':' + [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export async function checkPassword(password, stored) {
    const actual = await hashPassword(password, stored.split(':')[0]);
    if (actual.length !== stored.length)
        return false;
    let difference = 0;
    for (let i = 0; i < actual.length; i++)
        difference |= actual.charCodeAt(i) ^ stored.charCodeAt(i);
    return difference === 0;
}
export function businessDay(time, timezone) {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
    return ['year', 'month', 'day'].map(k => p.find(x => x.type === k).value).join('-');
}
export const queueNumber = n => 'A' + String(n).padStart(4, '0');
