import * as SQLite from "expo-sqlite";

/**
 * データベースを初期化し、必要なテーブルを作成する関数
 * SQLiteProviderのonInitコールバックから呼び出される
 */
export async function initDatabase(db: SQLite.SQLiteDatabase) {
  try {

    // ⚠️ 外部キー制約を有効化（必須）
    await db.execAsync("PRAGMA foreign_keys = ON;");

    // トランザクションを利用して、一気にテーブル群を作成する
    await db.withTransactionAsync(async () => {
      // ① terms テーブル（学期）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS terms (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            start_date TEXT,
            end_date   TEXT,
            is_current INTEGER NOT NULL DEFAULT 0
        );
      `);

      // ② classes テーブル（授業）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS classes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            term_id      INTEGER NOT NULL,
            name         TEXT    NOT NULL,
            teacher_name TEXT,
            day_of_week  INTEGER NOT NULL,
            period       INTEGER NOT NULL,
            url          TEXT,
            room         TEXT,
            is_archived  INTEGER NOT NULL DEFAULT 0,
            FOREIGN KEY (term_id) REFERENCES terms(id) ON DELETE CASCADE,
            UNIQUE (term_id, day_of_week, period)
        );
      `);

      // ③ task_locations テーブル（タスクの場所）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS task_locations (
            id   INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT    NOT NULL UNIQUE,
            url  TEXT,
            color TEXT
        );
      `);

      // task_locations に url カラムがない場合は追加する（マイグレーション用）
      try {
        await db.execAsync("ALTER TABLE task_locations ADD COLUMN url TEXT;");
      } catch (e) {
        // すでにカラムが存在する場合のエラーは無視する
      }

      // task_locations に color カラムがない場合は追加する（マイグレーション用）
      try {
        await db.execAsync("ALTER TABLE task_locations ADD COLUMN color TEXT;");
      } catch (e) {
        // すでにカラムが存在する場合のエラーは無視する
      }

      // ④ tasks テーブル（タスク）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS tasks (
            id                   INTEGER PRIMARY KEY AUTOINCREMENT,
            name                 TEXT    NOT NULL,
            class_id             INTEGER,
            location_id          INTEGER,
            format               TEXT    NOT NULL CHECK (format IN ('課題', 'レポート', '定期テスト', '小テスト', 'グループワーク')),
            created_at           TEXT    NOT NULL,
            due_date             TEXT    NOT NULL,
            updated_at           TEXT    NOT NULL,
            details              TEXT,
            is_completed         INTEGER NOT NULL DEFAULT 0,
            is_recurring         INTEGER NOT NULL DEFAULT 0,
            recurrence_interval  TEXT    DEFAULT 'weekly',
            FOREIGN KEY (class_id)    REFERENCES classes(id)        ON DELETE CASCADE,
            FOREIGN KEY (location_id) REFERENCES task_locations(id) ON DELETE SET NULL
        );
      `);

      // ⑤ task_attachments テーブル（添付ファイル）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS task_attachments (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id    INTEGER NOT NULL,
            file_uri   TEXT    NOT NULL,
            file_type  TEXT    NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
        );
      `);

      // ⑥ task_reminders テーブル（通知管理用）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS task_reminders (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id         INTEGER NOT NULL,
            remind_type     TEXT    NOT NULL,
            remind_at       TEXT    NOT NULL,
            notification_id TEXT,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
            UNIQUE (task_id, remind_type)
        );
      `);

      // ⑦ period_times テーブル（授業時間設定）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS period_times (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            period     INTEGER NOT NULL UNIQUE,
            start_time TEXT    NOT NULL,
            end_time   TEXT    NOT NULL
        );
      `);

      // ⑧ app_settings テーブル（アプリの各種設定用）
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
      `);

      // app_settings テーブルにデフォルトデータを挿入
      await db.execAsync(`
        INSERT OR IGNORE INTO app_settings (key, value) VALUES
          ('timetable_days', '5'), -- デフォルト: 5日 (月〜金)
          ('timetable_periods', '5'); -- デフォルト: 5時限
      `);

      // period_times テーブルにデフォルトデータを挿入
      await db.execAsync(`
        INSERT OR IGNORE INTO period_times (period, start_time, end_time) VALUES
          (1, '09:00', '10:30'),
          (2, '10:40', '12:10'),
          (3, '13:00', '14:30'),
          (4, '14:40', '16:10'),
          (5, '16:20', '17:50');
      `);

      // task_locations テーブルにデフォルトデータを挿入
      await db.execAsync(`
        INSERT OR IGNORE INTO task_locations (id, name, url) VALUES
          (2, '対面', NULL),
          (3, 'その他', NULL);
      `);

      // インデックス作成
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_classes_term_id    ON classes(term_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_class_id     ON tasks(class_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_due_date     ON tasks(due_date);
        CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
        CREATE INDEX IF NOT EXISTS idx_reminders_task_id  ON task_reminders(task_id);
        CREATE INDEX IF NOT EXISTS idx_attachments_task_id ON task_attachments(task_id);
      `);
    });

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
    throw error;
  }
}
