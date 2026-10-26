import { describe, expect, it } from "vitest";
import { getCompactHoneycombPosition } from "@/lib/honeycomb-layout";

const ROW_HEIGHT = Math.sqrt(3) / 2;
const EPSILON = 0.000001;

function layoutForCount(itemCount: number) {
  return Array.from({ length: itemCount }, (_, index) => {
    const position = getCompactHoneycombPosition(index, itemCount);
    const left = (position.columnStart - 1) / 2 + position.translateX;

    return {
      ...position,
      left,
      centerX: left + 0.5,
      centerY: position.rowIndex * ROW_HEIGHT,
    };
  });
}

function areNeighbors(
  first: ReturnType<typeof layoutForCount>[number],
  second: ReturnType<typeof layoutForCount>[number],
) {
  const deltaX = Math.abs(first.centerX - second.centerX);
  const deltaY = Math.abs(first.centerY - second.centerY);

  return (
    (deltaY < EPSILON && Math.abs(deltaX - 1) < EPSILON) ||
    (Math.abs(deltaY - ROW_HEIGHT) < EPSILON && Math.abs(deltaX - 0.5) < EPSILON)
  );
}

describe("compact honeycomb layout", () => {
  it.each(Array.from({ length: 30 }, (_, index) => index + 1))(
    "keeps all %i hexagons connected, interlocking, and centered",
    (itemCount) => {
      const positions = layoutForCount(itemCount);
      const occupied = new Set(
        positions.map(({ rowIndex, columnStart }) => `${rowIndex}:${columnStart}`),
      );

      expect(occupied.size).toBe(itemCount);

      const rowIndices = [...new Set(positions.map(({ rowIndex }) => rowIndex))].sort(
        (left, right) => left - right,
      );
      expect(rowIndices).toEqual(Array.from({ length: rowIndices.length }, (_, row) => row));

      const rowCounts = rowIndices.map(
        (rowIndex) => positions.filter((position) => position.rowIndex === rowIndex).length,
      );
      expect(rowCounts.every((count, rowIndex) => count <= (rowIndex % 2 === 0 ? 1 : 2))).toBe(true);

      const reached = new Set([0]);
      const pending = [0];
      while (pending.length) {
        const current = pending.pop()!;
        positions.forEach((position, index) => {
          if (!reached.has(index) && areNeighbors(positions[current], position)) {
            reached.add(index);
            pending.push(index);
          }
        });
      }
      expect(reached.size).toBe(itemCount);

      const minLeft = Math.min(...positions.map(({ left }) => left));
      const maxRight = Math.max(...positions.map(({ left }) => left + 1));
      expect((minLeft + maxRight) / 2).toBeCloseTo(1);
      expect(minLeft).toBeGreaterThanOrEqual(-EPSILON);
      expect(maxRight).toBeLessThanOrEqual(2 + EPSILON);
    },
  );
});