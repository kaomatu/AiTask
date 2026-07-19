import { useState, useCallback, useEffect } from 'react';

type Grid = number[][];
export type Direction = 'up' | 'down' | 'left' | 'right';

const SIZE = 4;

// 空のグリッドを作成
const createEmptyGrid = (): Grid => {
  return Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
};

// 空いているセルのリストを取得
const getEmptyCells = (grid: Grid) => {
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) {
        cells.push({ r, c });
      }
    }
  }
  return cells;
};

// ランダムな空きセルに 2 または 4 を追加
const addRandomTile = (grid: Grid): Grid => {
  const emptyCells = getEmptyCells(grid);
  if (emptyCells.length === 0) return grid;

  const randomCell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  const newValue = Math.random() < 0.9 ? 2 : 4;

  const newGrid = grid.map(row => [...row]);
  newGrid[randomCell.r][randomCell.c] = newValue;
  return newGrid;
};

// 1行（配列）を左に詰めてマージする
const slideAndMergeRow = (row: number[]): { newRow: number[], scoreIncrease: number } => {
  // 0を除去して詰める
  let filteredRow = row.filter(val => val !== 0);
  let scoreIncrease = 0;
  
  // マージ処理
  for (let i = 0; i < filteredRow.length - 1; i++) {
    if (filteredRow[i] !== 0 && filteredRow[i] === filteredRow[i + 1]) {
      filteredRow[i] *= 2;
      scoreIncrease += filteredRow[i];
      filteredRow[i + 1] = 0; // マージされた側は一時的に0にする
    }
  }
  
  // 再度0を除去して詰める
  filteredRow = filteredRow.filter(val => val !== 0);
  
  // 足りない分を0で埋める
  while (filteredRow.length < SIZE) {
    filteredRow.push(0);
  }
  
  return { newRow: filteredRow, scoreIncrease };
};

// グリッドを右に90度回転
const rotateGridRight = (grid: Grid): Grid => {
  const newGrid = createEmptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      newGrid[c][SIZE - 1 - r] = grid[r][c];
    }
  }
  return newGrid;
};

// グリッドを左に90度回転
const rotateGridLeft = (grid: Grid): Grid => {
  const newGrid = createEmptyGrid();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      newGrid[SIZE - 1 - c][r] = grid[r][c];
    }
  }
  return newGrid;
};

// ゲームオーバー判定
const checkGameOver = (grid: Grid): boolean => {
  if (getEmptyCells(grid).length > 0) return false;

  // 縦横で同じ数字が隣接しているかチェック
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const current = grid[r][c];
      if (
        (c < SIZE - 1 && grid[r][c + 1] === current) ||
        (r < SIZE - 1 && grid[r + 1][c] === current)
      ) {
        return false; // まだ動かせる
      }
    }
  }
  return true;
};

export const use2048 = () => {
  const [grid, setGrid] = useState<Grid>(createEmptyGrid());
  const [score, setScore] = useState<number>(0);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);

  // 初期化
  const reset = useCallback(() => {
    let newGrid = createEmptyGrid();
    newGrid = addRandomTile(newGrid);
    newGrid = addRandomTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setIsGameOver(false);
  }, []);

  // 初回マウント時に初期化
  useEffect(() => {
    reset();
  }, [reset]);

  // 移動処理
  const move = useCallback((direction: Direction) => {
    if (isGameOver) return;

    setGrid((prevGrid) => {
      let currentGrid = prevGrid;
      
      // 左方向への移動を基本として、他の方向はグリッドを回転させて処理する
      if (direction === 'right') {
        currentGrid = rotateGridRight(rotateGridRight(currentGrid)); // 180度
      } else if (direction === 'up') {
        currentGrid = rotateGridLeft(currentGrid); // 左に90度
      } else if (direction === 'down') {
        currentGrid = rotateGridRight(currentGrid); // 右に90度
      }

      let newGrid = createEmptyGrid();
      let hasChanged = false;
      let totalScoreIncrease = 0;

      // 左へスライド＆マージ
      for (let r = 0; r < SIZE; r++) {
        const { newRow, scoreIncrease } = slideAndMergeRow(currentGrid[r]);
        newGrid[r] = newRow;
        totalScoreIncrease += scoreIncrease;
        
        // 変更があったかチェック
        if (currentGrid[r].join(',') !== newRow.join(',')) {
          hasChanged = true;
        }
      }

      // 回転を元に戻す
      if (direction === 'right') {
        newGrid = rotateGridRight(rotateGridRight(newGrid));
      } else if (direction === 'up') {
        newGrid = rotateGridRight(newGrid); // 右に90度戻す
      } else if (direction === 'down') {
        newGrid = rotateGridLeft(newGrid); // 左に90度戻す
      }

      // 盤面が変化した場合のみ新しいタイルを追加
      if (hasChanged) {
        newGrid = addRandomTile(newGrid);
        setScore(prev => prev + totalScoreIncrease);
        
        if (checkGameOver(newGrid)) {
          setIsGameOver(true);
        }
        return newGrid;
      }
      
      return prevGrid;
    });
  }, [isGameOver]);

  return {
    grid,
    score,
    isGameOver,
    move,
    reset
  };
};
