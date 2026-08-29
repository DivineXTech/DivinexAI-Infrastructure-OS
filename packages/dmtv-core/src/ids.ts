import { randomUUID } from "node:crypto";

export { randomUUID };

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .concat(`-${randomUUID().slice(0, 8)}`);
}

export function handlify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${base || "creator"}_${randomUUID().slice(0, 8)}`;
}
