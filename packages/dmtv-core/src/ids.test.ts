import { describe, expect, test } from "bun:test";
import { handlify, slugify } from "./ids";

describe("slugify", () => {
  test("lowercases and hyphenates, with a unique suffix", () => {
    const slug = slugify("Nova Sound Studio");
    expect(slug).toMatch(/^nova-sound-studio-[a-f0-9]{8}$/);
  });

  test("two calls with the same input produce different slugs", () => {
    expect(slugify("Same Name")).not.toBe(slugify("Same Name"));
  });
});

describe("handlify", () => {
  test("lowercases and underscores, with a unique suffix", () => {
    const handle = handlify("Nova Rey");
    expect(handle).toMatch(/^nova_rey_[a-f0-9]{8}$/);
  });

  test("falls back to a default base when the input has no usable characters", () => {
    expect(handlify("!!!")).toMatch(/^creator_[a-f0-9]{8}$/);
  });
});
