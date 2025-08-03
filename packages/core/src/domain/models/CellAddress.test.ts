import { describe, expect, test } from "bun:test";
import { CellAddress } from "./CellAddress";

describe("CellAddress", () => {
  describe("create", () => {
    test("creates valid address", () => {
      const result = CellAddress.create(0, 0);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.row).toBe(0);
        expect(result.value.col).toBe(0);
      }
    });

    test("rejects negative row", () => {
      const result = CellAddress.create(-1, 0);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("non-negative");
      }
    });

    test("rejects negative column", () => {
      const result = CellAddress.create(0, -1);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("non-negative");
      }
    });
  });

  describe("fromString", () => {
    test("parses A1 notation", () => {
      const result = CellAddress.fromString("A1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.row).toBe(0);
        expect(result.value.col).toBe(0);
      }
    });

    test("parses Z26 notation", () => {
      const result = CellAddress.fromString("Z26");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.row).toBe(25);
        expect(result.value.col).toBe(25);
      }
    });

    test("parses AA1 notation", () => {
      const result = CellAddress.fromString("AA1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.row).toBe(0);
        expect(result.value.col).toBe(26);
      }
    });

    test("parses AB10 notation", () => {
      const result = CellAddress.fromString("AB10");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.row).toBe(9);
        expect(result.value.col).toBe(27);
      }
    });

    test("handles lowercase", () => {
      const result = CellAddress.fromString("a1");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.row).toBe(0);
        expect(result.value.col).toBe(0);
      }
    });

    test("rejects invalid format", () => {
      const result = CellAddress.fromString("1A");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Invalid cell address format");
      }
    });

    test("rejects empty string", () => {
      const result = CellAddress.fromString("");
      expect(result.ok).toBe(false);
    });
  });

  describe("toString", () => {
    test("converts to A1 notation", () => {
      const addr = CellAddress.create(0, 0);
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        expect(addr.value.toString()).toBe("A1");
      }
    });

    test("converts to Z26 notation", () => {
      const addr = CellAddress.create(25, 25);
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        expect(addr.value.toString()).toBe("Z26");
      }
    });

    test("converts to AA1 notation", () => {
      const addr = CellAddress.create(0, 26);
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        expect(addr.value.toString()).toBe("AA1");
      }
    });

    test("round-trip conversion", () => {
      const testCases = ["A1", "Z99", "AA1", "AB10", "ZZ999"];
      for (const testCase of testCases) {
        const result = CellAddress.fromString(testCase);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.toString()).toBe(testCase);
        }
      }
    });
  });

  describe("equals", () => {
    test("same addresses are equal", () => {
      const addr1 = CellAddress.create(5, 10);
      const addr2 = CellAddress.create(5, 10);
      expect(addr1.ok && addr2.ok).toBe(true);
      if (addr1.ok && addr2.ok) {
        expect(addr1.value.equals(addr2.value)).toBe(true);
      }
    });

    test("different addresses are not equal", () => {
      const addr1 = CellAddress.create(5, 10);
      const addr2 = CellAddress.create(5, 11);
      expect(addr1.ok && addr2.ok).toBe(true);
      if (addr1.ok && addr2.ok) {
        expect(addr1.value.equals(addr2.value)).toBe(false);
      }
    });
  });

  describe("offset", () => {
    test("positive offset", () => {
      const addr = CellAddress.create(5, 10);
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        const result = addr.value.offset(2, 3);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.row).toBe(7);
          expect(result.value.col).toBe(13);
        }
      }
    });

    test("negative offset", () => {
      const addr = CellAddress.create(5, 10);
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        const result = addr.value.offset(-2, -3);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.row).toBe(3);
          expect(result.value.col).toBe(7);
        }
      }
    });

    test("offset resulting in negative coordinates fails", () => {
      const addr = CellAddress.create(1, 1);
      expect(addr.ok).toBe(true);
      if (addr.ok) {
        const result = addr.value.offset(-5, -5);
        expect(result.ok).toBe(false);
      }
    });
  });
});
