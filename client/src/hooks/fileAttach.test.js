import { describe, it, expect } from "vitest";
import { planAttachment, hasDirectory, renameIfGeneric } from "./useFileAttach";

const file = (name, type = "text/plain") =>
  new File(["x"], name, { type });

describe("planAttachment — capacity", () => {
  it("accepts everything when there is room", () => {
    const { accepted, notice } = planAttachment({
      current: 1,
      incoming: [file("a.txt"), file("b.txt")],
      maxFiles: 5,
    });
    expect(accepted).toHaveLength(2);
    expect(notice).toBeNull();
  });

  it("fills the remaining slots and explains the shortfall", () => {
    const { accepted, notice } = planAttachment({
      current: 3,
      incoming: [file("a.txt"), file("b.txt"), file("c.txt")],
      maxFiles: 5,
    });
    // Partial acceptance rather than rejecting the whole drop.
    expect(accepted).toHaveLength(2);
    expect(notice).toMatch(/Only 2 of 3/);
  });

  it("rejects outright when already full", () => {
    const { accepted, notice } = planAttachment({
      current: 5,
      incoming: [file("a.txt")],
      maxFiles: 5,
    });
    expect(accepted).toHaveLength(0);
    expect(notice).toMatch(/at most 5/);
  });

  it("is silent on an empty drop", () => {
    // A drag that carries no files at all must not produce a warning.
    expect(planAttachment({ current: 0, incoming: [], maxFiles: 5 })).toEqual({
      accepted: [],
      notice: null,
    });
  });

  it("never exceeds the cap even from a single oversized batch", () => {
    const { accepted } = planAttachment({
      current: 0,
      incoming: Array.from({ length: 20 }, (_, i) => file(`f${i}.txt`)),
      maxFiles: 5,
    });
    expect(accepted).toHaveLength(5);
  });

  it("tolerates null entries without counting them", () => {
    const { accepted } = planAttachment({
      current: 0,
      incoming: [file("a.txt"), null, undefined],
      maxFiles: 5,
    });
    expect(accepted).toHaveLength(1);
  });
});

describe("hasDirectory", () => {
  const entry = (isDirectory) => ({
    kind: "file",
    webkitGetAsEntry: () => ({ isDirectory }),
  });

  it("detects a dropped folder", () => {
    expect(hasDirectory([entry(false), entry(true)])).toBe(true);
  });

  it("passes plain files through", () => {
    expect(hasDirectory([entry(false), entry(false)])).toBe(false);
  });

  it("ignores non-file items such as dragged text", () => {
    expect(hasDirectory([{ kind: "string" }])).toBe(false);
  });

  it("does not throw when webkitGetAsEntry is unavailable", () => {
    // Older/non-Chromium browsers omit it; a missing API must degrade to
    // "no folder detected" rather than crashing the drop handler.
    expect(hasDirectory([{ kind: "file" }])).toBe(false);
    expect(hasDirectory(undefined)).toBe(false);
  });
});

describe("renameIfGeneric — pasted screenshots", () => {
  const at = new Date("2026-08-11T09:30:15.500Z");

  it("renames the browser's generic clipboard filename", () => {
    const renamed = renameIfGeneric(file("image.png", "image/png"), at);
    expect(renamed.name).toBe("pasted-2026-08-11T09-30-15.png");
    expect(renamed.type).toBe("image/png");
  });

  it("keeps a real filename from a copied file", () => {
    const original = file("quarterly-report.pdf", "application/pdf");
    expect(renameIfGeneric(original, at).name).toBe("quarterly-report.pdf");
  });

  it("derives the extension from the mime type", () => {
    const renamed = renameIfGeneric(file("image.webp", "image/webp"), at);
    expect(renamed.name).toMatch(/\.webp$/);
  });

  it("falls back to .png when the mime type is missing", () => {
    const nameless = new File(["x"], "", { type: "" });
    expect(renameIfGeneric(nameless, at).name).toMatch(/^pasted-.*\.png$/);
  });

  it("produces a filesystem-safe name (no colons from the timestamp)", () => {
    // ISO time contains ":" which is illegal in filenames on Windows and
    // awkward everywhere else.
    expect(renameIfGeneric(file("image.png", "image/png"), at).name).not.toMatch(/:/);
  });
});
