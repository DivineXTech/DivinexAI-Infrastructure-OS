import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("serializes rows with a header", () => {
    const csv = toCsv([{ a: "1", b: "2" }], ["a", "b"]);
    expect(csv).toBe("a,b\r\n1,2\r\n");
  });

  it("escapes commas, quotes, and newlines", () => {
    const csv = toCsv([{ name: 'Say "hi", friend\nnext line' }], ["name"]);
    expect(csv).toBe('name\r\n"Say ""hi"", friend\nnext line"\r\n');
  });

  it("renders null/undefined as empty cells", () => {
    const csv = toCsv([{ a: null, b: undefined }], ["a", "b"]);
    expect(csv).toBe("a,b\r\n,\r\n");
  });
});
