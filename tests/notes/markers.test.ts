import { describe, expect, it } from "vitest";
import {
  createManagedSection,
  encodeMarkerIdentity,
  parseManagedSection,
} from "../../src/notes/markers";

const identity = { providerId: "provider/one", bookId: "book 1?" } as const;

describe("managed section markers", () => {
  it("writes canonical percent-encoded version-one identity markers and parses them", () => {
    const section = createManagedSection(identity, "# Generated\n");

    expect(section).toContain("version=1 provider=provider%2Fone book-id=book%201%3F");
    expect(parseManagedSection(`before\n${section}\nafter`)).toEqual({
      ok: true,
      value: { identity, startLine: 1, endLine: 3, body: "# Generated" },
    });
    expect(encodeMarkerIdentity(identity)).toEqual({ provider: "provider%2Fone", bookId: "book%201%3F" });
  });

  it.each([
    ["missing end", "<!-- book-highlights-importer:start version=1 provider=p book-id=b -->\nbody"],
    ["duplicate region", "<!-- book-highlights-importer:start version=1 provider=p book-id=b -->\n<!-- book-highlights-importer:end -->\n<!-- book-highlights-importer:start version=1 provider=p book-id=b -->\n<!-- book-highlights-importer:end -->"],
    ["nested starts", "<!-- book-highlights-importer:start version=1 provider=p book-id=b -->\n<!-- book-highlights-importer:start version=1 provider=p book-id=b -->\n<!-- book-highlights-importer:end -->\n<!-- book-highlights-importer:end -->"],
    ["unsupported version", "<!-- book-highlights-importer:start version=2 provider=p book-id=b -->\n<!-- book-highlights-importer:end -->"],
    ["unknown attribute", "<!-- book-highlights-importer:start version=1 provider=p book-id=b extra=x -->\n<!-- book-highlights-importer:end -->"],
    ["invalid percent encoding", "<!-- book-highlights-importer:start version=1 provider=%ZZ book-id=b -->\n<!-- book-highlights-importer:end -->"],
    ["non-canonical percent encoding", "<!-- book-highlights-importer:start version=1 provider=%2fone book-id=b -->\n<!-- book-highlights-importer:end -->"],
    ["malformed marker-like line", "<!-- book-highlights-importer:start version=1 provider=p -->\n<!-- book-highlights-importer:end -->"],
  ])("rejects %s", (_name, content) => {
    expect(parseManagedSection(content).ok).toBe(false);
  });
});
