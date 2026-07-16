import { Alert as RNAlert, Platform } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export const Alert = {
  alert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => {
    if (Platform.OS === 'web') {
      const fullMessage = message ? `${title}\n\n${message}` : title;
      if (!buttons || buttons.length === 0) {
        alert(fullMessage);
      } else if (buttons.length === 1) {
        alert(fullMessage);
        buttons[0].onPress?.();
      } else {
        const confirmed = confirm(fullMessage);
        if (confirmed) {
          // キャンセル以外のスタイルを持つボタンを実行する
          const positiveButton = buttons.find((b) => b.style !== 'cancel');
          if (positiveButton) {
            positiveButton.onPress?.();
          } else {
            buttons[0].onPress?.();
          }
        } else {
          // キャンセルボタンを実行する
          const cancelButton = buttons.find((b) => b.style === 'cancel');
          if (cancelButton) {
            cancelButton.onPress?.();
          }
        }
      }
    } else {
      RNAlert.alert(title, message, buttons, options);
    }
  },
};
