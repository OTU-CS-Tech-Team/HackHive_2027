export type CompactHoneycombPosition = {
  columnStart: 1 | 2 | 3;
  rowIndex: number;
  translateX: number;
};

export function getCompactHoneycombPosition(
  index: number,
  itemCount: number,
): CompactHoneycombPosition {
  const patternIndex = Math.floor(index / 3);
  const positionInPattern = index % 3;
  const remainingInPattern = Math.min(3, itemCount - patternIndex * 3);
  const translateX = itemCount === 2 ? 0.25 : 0;

  if (positionInPattern === 0) {
    return {
      columnStart: 2,
      rowIndex: patternIndex * 2,
      translateX,
    };
  }

  const isPartialPair = remainingInPattern === 2;
  const columnStart = isPartialPair || positionInPattern === 1 ? 1 : 3;

  return {
    columnStart,
    rowIndex: patternIndex * 2 + 1,
    translateX,
  };
}