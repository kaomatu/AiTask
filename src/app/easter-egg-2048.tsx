import React, { useRef, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, PanResponder, SafeAreaView, Platform, useWindowDimensions } from 'react-native';
import { use2048, Direction } from '@/hooks/use2048';
import { Colors } from '@/constants/colors';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

// タイルの色定義
const TILE_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: '#cdc1b4', text: '#cdc1b4' }, // 空タイル
  2: { bg: '#eee4da', text: '#776e65' },
  4: { bg: '#ede0c8', text: '#776e65' },
  8: { bg: '#f2b179', text: '#f9f6f2' },
  16: { bg: '#f59563', text: '#f9f6f2' },
  32: { bg: '#f67c5f', text: '#f9f6f2' },
  64: { bg: '#f65e3b', text: '#f9f6f2' },
  128: { bg: '#edcf72', text: '#f9f6f2' },
  256: { bg: '#edcc61', text: '#f9f6f2' },
  512: { bg: '#edc850', text: '#f9f6f2' },
  1024: { bg: '#edc53f', text: '#f9f6f2' },
  2048: { bg: '#edc22e', text: '#f9f6f2' },
};

const getTileColor = (val: number) => {
  if (val > 2048) return { bg: '#3c3a32', text: '#f9f6f2' };
  return TILE_COLORS[val] || TILE_COLORS[0];
};

export default function EasterEgg2048Screen() {
  const { grid, score, isGameOver, move, reset } = use2048();
  const { width, height } = useWindowDimensions();

  // パソコン（横長）やスマホ（縦長）どちらでも画面に収まるように盤面サイズを計算
  const boardSize = Math.min(width * 0.9, height * 0.6, 500);

  // キーボード操作対応（Web・パソコン用）
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 矢印キーで画面がスクロールしてしまうのを防ぐ
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          move('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          move('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          move('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          move('right');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [move]);

  // スワイプ検知
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (evt, gestureState) => {
          // 少し動かした時だけ反応させる（タップとの誤爆を防ぐ）
          return Math.abs(gestureState.dx) > 20 || Math.abs(gestureState.dy) > 20;
        },
        onPanResponderRelease: (evt, gestureState) => {
          const { dx, dy } = gestureState;
          if (Math.abs(dx) > Math.abs(dy)) {
            // 横スワイプ
            if (Math.abs(dx) > 30) {
              move(dx > 0 ? 'right' : 'left');
            }
          } else {
            // 縦スワイプ
            if (Math.abs(dy) > 30) {
              move(dy > 0 ? 'down' : 'up');
            }
          }
        },
      }),
    [move]
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* ヘッダー領域 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>2048</Text>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <Text style={styles.subtitle}>Join the numbers and get to the 2048 tile!</Text>
        <TouchableOpacity style={styles.newGameButton} onPress={reset}>
          <Text style={styles.newGameText}>New Game</Text>
        </TouchableOpacity>
      </View>

      {/* ゲームボード */}
      <View style={[styles.boardContainer, { width: boardSize, height: boardSize }]} {...panResponder.panHandlers}>
        <View style={styles.board}>
          {grid.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.row}>
              {row.map((val, colIndex) => {
                const color = getTileColor(val);
                return (
                  <View
                    key={`cell-${rowIndex}-${colIndex}`}
                    style={[styles.tile, { backgroundColor: color.bg }]}
                  >
                    {val !== 0 && (
                      <Text
                        style={[
                          styles.tileText,
                          { color: color.text },
                          val > 100 ? styles.tileTextMedium : null,
                          val > 1000 ? styles.tileTextSmall : null,
                        ]}
                      >
                        {val}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          ))}
        </View>

        {/* ゲームオーバー時のオーバーレイ */}
        {isGameOver && (
          <View style={styles.gameOverOverlay}>
            <Text style={styles.gameOverText}>Game Over!</Text>
            <TouchableOpacity style={styles.tryAgainButton} onPress={reset}>
              <Text style={styles.tryAgainText}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#faf8ef', // 2048の標準的な背景色
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '90%',
    marginTop: 20,
    marginBottom: 10,
  },
  backButton: {
    padding: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#776e65',
  },
  scoreContainer: {
    backgroundColor: '#bbada0',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#eee4da',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  actionRow: {
    flexDirection: 'row',
    width: '90%',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  subtitle: {
    color: '#776e65',
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  newGameButton: {
    backgroundColor: '#8f7a66',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  newGameText: {
    color: '#f9f6f2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  boardContainer: {
    position: 'relative',
    backgroundColor: '#bbada0',
    borderRadius: 8,
    padding: 10,
  },
  board: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10, // 行間の隙間
  },
  tile: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginHorizontal: 5, // 列間の隙間
  },
  tileText: {
    fontSize: 36,
    fontWeight: 'bold',
  },
  tileTextMedium: {
    fontSize: 28,
  },
  tileTextSmall: {
    fontSize: 22,
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(238, 228, 218, 0.73)',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  gameOverText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#776e65',
    marginBottom: 20,
  },
  tryAgainButton: {
    backgroundColor: '#8f7a66',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  tryAgainText: {
    color: '#f9f6f2',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
