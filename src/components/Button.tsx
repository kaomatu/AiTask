import React from 'react';
// Expoに標準で組み込まれているアイコンセットをインポートします [1]
import FontAwesome from '@expo/vector-icons/FontAwesome';

// TypeScriptの型定義：このボタンコンポーネントが受け取るデータ（Props）を定義します [2]
interface ButtonProps {
    title: string;        // ボタンに表示するテキスト（必須）
    iconName: any;        // FontAwesomeのアイコン名（必須）
    onPress: () => void;  // ボタンがタップされたときの処理（必須）
}

export default function Button({ title, iconName, onPress }: ButtonProps) {
    return (
        // アイコン付きボタンコンポーネントを利用し、見た目や動作を設定します [3]
        <FontAwesome.Button
            name={iconName}
            backgroundColor="#a0a0a0ff"  // ボタンの背景色 [4]
            borderRadius={5}           // ボタンの角の丸み [4]
            onPress={onPress}          // タップされた時に実行される関数 [4]
        >
            {title}
        </FontAwesome.Button>
    );
}