/**
 * Firebase StorageのダウンロードURLなどから元のファイル名を抽出します。
 * クエリパラメータやURLエンコードされたパスを処理し、アプリで付与したタイムスタンプを取り除きます。
 */
export const extractFilenameFromUri = (uri: string): string => {
  if (!uri) return '添付ファイル';
  
  // 1. クエリパラメータ（?alt=media等）を削除
  const pathWithoutQuery = uri.split('?')[0];
  
  // 2. URLエンコードされたスラッシュ(%2F) または普通のスラッシュ(/) で分割して最後を取得
  let filenameEncoded = pathWithoutQuery;
  if (pathWithoutQuery.includes('%2F')) {
    filenameEncoded = pathWithoutQuery.split('%2F').pop() || '';
  } else if (pathWithoutQuery.includes('/')) {
    filenameEncoded = pathWithoutQuery.split('/').pop() || '';
  }

  // 3. URLデコード
  const filename = decodeURIComponent(filenameEncoded);

  // 4. アップロード時に付与したタイムスタンプ（1784354465312_ など）を削除
  // 先頭が数字の連続＋アンダースコアであれば消す
  const originalName = filename.replace(/^\d+_/, '');
  
  return originalName || '添付ファイル';
};
