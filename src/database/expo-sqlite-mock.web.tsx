import React, { createContext, useContext } from 'react';

// ダミーのデータベースオブジェクト
const dummyDb = {
  runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
  getFirstAsync: async () => null,
  getAllAsync: async () => [],
  execAsync: async () => {},
  withTransactionAsync: async (cb: () => Promise<void>) => {
    await cb();
  },
};

const SQLiteContext = createContext<any>(dummyDb);

export const SQLiteProvider = ({ children, databaseName, onInit }: any) => {
  // Web上では初期化処理（onInit）を行わず、単に子供のコンポーネントを描画するだけにする
  return (
    <SQLiteContext.Provider value={dummyDb}>
      {children}
    </SQLiteContext.Provider>
  );
};

export const useSQLiteContext = () => {
  return useContext(SQLiteContext);
};
