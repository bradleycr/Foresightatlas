/**
 * Map-first loading.
 *
 * true   The loading mark drops when people and travel are in. Luma and RSVPs
 *        load after that, still live from the sheet and from Luma. Nothing is
 *        saved to a JSON file.
 * false  Restore the old behavior: one /api/database request, and the loading
 *        mark stays up until events are merged too.
 */
export const DEFER_PROGRAMMING_LOAD = true;
