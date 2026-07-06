# データベース設計書 (Database Design Document) v3.0

本ドキュメントは、Expo (React Native + SQLite) を用いて開発する、学生向けの時間割・タスク管理アプリのデータベース設計書です。
手書きの初期設計をベースに、システムの安定動作、通知（リマインダー）の複数設定、および「1週間毎の繰り返し」機能に対応した拡張設計を記述しています。

> **v3.0 変更点**: 
> - 履歴保持のため、繰り返しタスク完了時に「完了」状態を保持しつつ次回分のタスクを新規作成するロジックに変更。
> - 過去のタスク履歴消失を防ぐため、`classes` テーブルに論理削除（アーカイブ）機能 `is_archived` を追加。
> - 前期・後期などの切り替えに対応するため、`terms`（学期）テーブルを新規追加し、時間割の重複制約を学期ごとに変更。

---

## 1. 永続化アーキテクチャの概要

アプリ内のデータ管理は、その特性に応じて以下の2つの手法を使い分けます。

1. **Expo SQLite (ローカル関係データベース)**
   - 授業、タスク、通知、場所など、構造化され、追加・検索・変更が頻繁に発生するリレーショナルデータの管理に使用します。
2. **Key-Value型ローカルストレージ (`@react-native-async-storage/async-storage`)**
   - アプリ全体の環境設定（時間割の最大曜日、最大時限など）のシンプルな設定データの管理に使用します。

### ⚠️ SQLite 外部キー制約の有効化（必須）

SQLiteでは外部キー制約がデフォルトで **無効** です。
アプリ起動時（データベース接続直後）に、以下のPRAGMAを **必ず実行** してください。

```sql
PRAGMA foreign_keys = ON;
```

これを実行しないと、`ON DELETE CASCADE` や `ON DELETE SET NULL` などの外部キー制約が一切動作しません。

---

## 2. Key-Valueストレージ（アプリ基本設定）の設計

「日程表」の構成など、リストとして増殖しないアプリの環境設定は `@react-native-async-storage/async-storage` で管理します。

| キー (Key) | 型 (Type) | 説明・許容値 |
| :--- | :--- | :--- |
| `setting_max_days` | `number` | 時間割を何曜日まで表示するか（0: 月 〜 6: 日） |
| `setting_max_periods` | `number` | 時間割を何時限まで表示するか（1 〜 7） |

---

## 3. SQLite テーブル論理設計

### ① `terms` テーブル（学期）【新規追加】
前期・後期など、時間割の切り替え単位となる期間を管理します。

| カラム名 (Column) | データ型 (SQLite) | 制約 (Constraint) | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 学期を一意に識別する内部ID |
| `name` | TEXT | NOT NULL | 学期の名前（例: "2024年前期", "秋学期"） |
| `start_date` | TEXT | | 学期の開始日（ISO 8601形式） |
| `end_date` | TEXT | | 学期の終了日（ISO 8601形式） |
| `is_current` | INTEGER | NOT NULL DEFAULT 0 | 現在の学期フラグ（1: 現在表示中の学期） |

### ② `classes` テーブル（授業）
時間割のコマおよびタスクの所属先となる授業情報を管理します。

| カラム名 (Column) | データ型 (SQLite) | 制約 (Constraint) | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 授業を一意に識別する内部ID |
| `term_id` | INTEGER | FOREIGN KEY (`terms`.`id`) ON DELETE CASCADE | 所属する学期のID |
| `name` | TEXT | NOT NULL | 授業の名前 |
| `teacher_name` | TEXT | | 担当教員の名前 |
| `day_of_week` | INTEGER | NOT NULL | 授業の曜日（0:月, 1:火, 2:水, 3:木, 4:金, 5:土, 6:日） |
| `period` | INTEGER | NOT NULL | 授業の時限（1 〜 7） |
| `url` | TEXT | | 主に使うタスクの提出場所のURL |
| `room` | TEXT | | 教室名・場所（例: "201教室"） |
| `is_archived` | INTEGER | NOT NULL DEFAULT 0 | アーカイブフラグ（1: 過去の授業として非表示。タスク履歴維持のため物理削除の代わりに使用） |

**テーブル制約:**
```sql
UNIQUE (term_id, day_of_week, period)  -- 同じ学期内で、同じ曜日・時限に授業を重複登録できないようにする
```

### ③ `task_locations` テーブル（タスクの場所）
タスクの提出先や実施場所のマスターデータを管理します。ユーザーが自由に追加・管理できます。

| カラム名 (Column) | データ型 (SQLite) | 制約 (Constraint) | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 場所を一意に識別する内部ID |
| `name` | TEXT | NOT NULL UNIQUE | 場所の名前（例: "Teams", "Moodle", "対面授業"） |

### ④ `tasks` テーブル（タスク）
課題やテストなどのタスク本体を管理します。繰り返しルールの設定情報も保持します。

| カラム名 (Column) | データ型 (SQLite) | 制約 (Constraint) | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | タスクを一意に識別する内部ID |
| `name` | TEXT | NOT NULL | タスクの名前 |
| `class_id` | INTEGER | FOREIGN KEY (`classes`.`id`) ON DELETE CASCADE | 対象の授業ID |
| `location_id` | INTEGER | FOREIGN KEY (`task_locations`.`id`) ON DELETE SET NULL | タスクの場所ID（場所削除時はNULLに設定） |
| `format` | TEXT | NOT NULL, CHECK制約あり | タスクの形式（下記の許容値を参照） |
| `created_at` | TEXT | NOT NULL | タスクの作成日時（ISO 8601形式: `YYYY-MM-DD HH:MM:SS`） |
| `due_date` | TEXT | NOT NULL | タスクの締切日時（ISO 8601形式: `YYYY-MM-DD HH:MM:SS`） |
| `updated_at` | TEXT | NOT NULL | タスクの最終更新日時（ISO 8601形式: `YYYY-MM-DD HH:MM:SS`） |
| `details` | TEXT | | 詳細メモ（ユーザーが自由に記述できる領域） |
| `is_completed` | INTEGER | NOT NULL DEFAULT 0 | 完了フラグ（0: 未完了, 1: 完了） |
| `is_recurring` | INTEGER | NOT NULL DEFAULT 0 | 1週間毎の繰り返しフラグ（0: しない, 1: する） |
| `recurrence_interval` | TEXT | DEFAULT 'weekly' | 繰り返しの間隔設定（拡張用。現在は `'weekly'` 固定） |

**テーブル制約:**
```sql
CHECK (format IN ('課題', 'レポート', '定期テスト', '小テスト', 'グループワーク'))
```

### ⑤ `task_reminders` テーブル（通知管理用）
1つのタスクに対して「3日前」「1日前」「当日の朝」など、複数の通知をスケジュール・管理するためのテーブルです（1対多の関係）。

| カラム名 (Column) | データ型 (SQLite) | 制約 (Constraint) | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | リマインダーを一意に識別する内部ID |
| `task_id` | INTEGER | FOREIGN KEY (`tasks`.`id`) ON DELETE CASCADE | 対象のタスクID（タスク削除時に連動削除） |
| `remind_type` | TEXT | NOT NULL | 通知の種類（`'3_days_before'`, `'1_day_before'`, `'morning'`） |
| `remind_at` | TEXT | NOT NULL | 実際に通知を鳴らす日時（ISO 8601形式） |
| `notification_id` | TEXT | | Expo Notificationsから発行された通知予約の受付ID（キャンセル・変更時に必須） |

**テーブル制約:**
```sql
UNIQUE (task_id, remind_type)  -- 同一タスクに同じ種類の通知を重複登録できないようにする
```

---

頻繁に検索・ソートに使用されるカラムに対して、以下のインデックスを作成します。

### ⑥ `period_times` テーブル（授業時間設定）
時限ごとの開始時間・終了時間を管理します。大学ごとの時間の違いに柔軟に対応し、現在行われている授業を強調表示するために使用します。

| カラム名 (Column) | データ型 (SQLite) | 制約 (Constraint) | 説明 |
| :--- | :--- | :--- | :--- |
| `id` | INTEGER | PRIMARY KEY AUTOINCREMENT | 授業時間を一意に識別する内部ID |
| `period` | INTEGER | NOT NULL UNIQUE | 時限（1, 2, 3...） |
| `start_time` | TEXT | NOT NULL | 開始時間（例: "09:00"） |
| `end_time` | TEXT | NOT NULL | 終了時間（例: "10:30"） |

---

## 4. インデックス定義

```sql
-- classes テーブル: 学期ごとの絞り込み
CREATE INDEX idx_classes_term_id ON classes(term_id);

-- tasks テーブル: 授業ごとの絞り込み
CREATE INDEX idx_tasks_class_id ON tasks(class_id);

-- tasks テーブル: 締切日でのソート・範囲検索
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

-- tasks テーブル: 未完了タスクの抽出
CREATE INDEX idx_tasks_is_completed ON tasks(is_completed);

-- task_reminders テーブル: タスクIDでの検索
CREATE INDEX idx_reminders_task_id ON task_reminders(task_id);
```

---

## 5. テーブル作成SQL（完全版）

以下は、上記の設計を反映した `CREATE TABLE` 文の完全版です。

```sql
-- ⚠️ 外部キー制約を有効化（アプリ起動時に必ず実行すること）
PRAGMA foreign_keys = ON;

-- ① terms テーブル（学期）
CREATE TABLE IF NOT EXISTS terms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    start_date TEXT,
    end_date   TEXT,
    is_current INTEGER NOT NULL DEFAULT 0
);

-- ② classes テーブル（授業）
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

-- ③ task_locations テーブル（タスクの場所）
CREATE TABLE IF NOT EXISTS task_locations (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT    NOT NULL UNIQUE
);

-- ④ tasks テーブル（タスク）
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

-- ⑤ task_reminders テーブル（通知管理用）
CREATE TABLE IF NOT EXISTS task_reminders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id         INTEGER NOT NULL,
    remind_type     TEXT    NOT NULL,
    remind_at       TEXT    NOT NULL,
    notification_id TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    UNIQUE (task_id, remind_type)
);

-- ⑥ period_times テーブル（授業時間設定）
CREATE TABLE IF NOT EXISTS period_times (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    period     INTEGER NOT NULL UNIQUE,
    start_time TEXT    NOT NULL,
    end_time   TEXT    NOT NULL
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_classes_term_id    ON classes(term_id);
CREATE INDEX IF NOT EXISTS idx_tasks_class_id     ON tasks(class_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date     ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_is_completed ON tasks(is_completed);
CREATE INDEX IF NOT EXISTS idx_reminders_task_id  ON task_reminders(task_id);
```

---

## 6. 繰り返しタスク・通知の制御ロジック（実装ガイドライン）

「1週間毎に繰り返す」かつ「複数通知を上限なしに選べる」仕様を満たすため、アプリ側（JavaScript/TypeScript）では以下のロジックで制御します。

### タスク追加時のフロー
1. ユーザーがタスクを入力し、通知のタイミング（例: 3日前、当日の朝）と「1週間毎に繰り返す」にチェックを入れて保存。
2. `tasks` テーブルに基本情報をインサートし、新規作成された `task_id` を取得。
   - `created_at` と `updated_at` には現在日時を設定。
3. **通知のスケジュール処理：**
   - 最初の締切日（`due_date`）から逆算して、選択された通知タイミングの具体的な日時（`remind_at`）を算出。
   - `Expo.Notifications.scheduleNotificationAsync` を呼び出して端末に通知を予約。
   - 返却された通知ID（`notification_id`）と算出した日時を `task_reminders` テーブルに保存。

### タスク更新時の注意
- タスクの内容を変更した際は、`updated_at` を現在日時に更新する。

### タスク完了（トグルON）時の挙動（リピートと履歴保持処理）
ユーザーが繰り返しタスクを「完了」とした場合、過去の達成履歴を残すために、**現在のタスクを完了状態にしつつ、次回分のタスクを新規作成（INSERT）します。**

1. **現在のタスクの完了処理:**
   - 対象タスクの `is_completed` を `1` に更新し、`updated_at` を現在日時にする。
   - このタスクに紐づく未発火の通知（`task_reminders`）があれば、デバイスからキャンセルしてテーブルから削除する（または発火済みとして放置）。
2. **次回のタスクの新規作成（クローン）:**
   - 完了したタスクの基本情報（`name`, `class_id`, `format` など）をコピー。
   - `due_date` を元のタスクから「1週間後（+7日）」の日時に設定。
   - 新しいレコードとして `tasks` テーブルに `INSERT` を行う（新しい `task_id` が発行される）。
3. **次回タスクの通知スケジュール:**
   - 新しい `due_date` に基づいて、再度「3日前」「当日の朝」などの通知日時を再計算し、デバイスへ通知を予約。
   - 新しい `task_id` と共に `task_reminders` テーブルに登録する。
