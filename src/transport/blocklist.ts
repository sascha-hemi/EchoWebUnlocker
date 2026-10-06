/** Partitions the tools tab must never flash/erase (spec §6). */
const BLOCKED = new Set(["preloader", "lk", "lk_a", "lk_b", "tee1", "tee2", "tz", "expdb", "swdl"]);

export const isPartitionBlocked = (name: string): boolean => BLOCKED.has(name.toLowerCase());
