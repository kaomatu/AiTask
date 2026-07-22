import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, auth, storage } from '../config/firebase';

// ユーザーIDを取得するヘルパー関数
const getUid = () => {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("No authenticated user");
  return uid;
};

// 新規ユーザー登録時のデフォルトデータ初期化
export async function initializeUserData(uid: string, username: string) {
  const batch = writeBatch(db);

  // 1. Settings (表示ユーザー名とデフォルト設定)
  batch.set(doc(db, 'users', uid, 'settings', 'user_name'), { value: username });
  batch.set(doc(db, 'users', uid, 'settings', 'timetable_days'), { value: '5' });
  batch.set(doc(db, 'users', uid, 'settings', 'timetable_periods'), { value: '5' });

  // 2. Period Times (デフォルト時限設定)
  const periods = [
    { period: 1, start_time: '09:00', end_time: '10:30' },
    { period: 2, start_time: '10:40', end_time: '12:10' },
    { period: 3, start_time: '13:00', end_time: '14:30' },
    { period: 4, start_time: '14:40', end_time: '16:10' },
    { period: 5, start_time: '16:20', end_time: '17:50' },
  ];
  periods.forEach(p => {
    batch.set(doc(db, 'users', uid, 'period_times', String(p.period)), p);
  });

  // 3. Task Locations (デフォルトの場所)
  const locations = [
    { id: 2, name: '対面', url: null, color: null },
    { id: 3, name: 'その他', url: null, color: null },
  ];
  locations.forEach(loc => {
    batch.set(doc(db, 'users', uid, 'task_locations', String(loc.id)), loc);
  });

  // 4. Terms (デフォルトの学期)
  batch.set(doc(db, 'users', uid, 'terms', '1'), {
    id: 1,
    name: 'デフォルト学期',
    start_date: '2024-04-01',
    end_date: '2024-08-31',
    is_current: 1
  });

  await batch.commit();
}

// --- Settings API ---
export async function getSettings() {
  const uid = getUid();
  const colRef = collection(db, 'users', uid, 'settings');
  const snap = await getDocs(colRef);
  const settings: Record<string, string> = {};
  snap.docs.forEach(doc => {
    settings[doc.id] = doc.data().value;
  });
  return settings;
}

export async function getSetting(key: string): Promise<string | null> {
  const settings = await getSettings();
  return settings[key] || null;
}

export async function saveSetting(key: string, value: string) {
  const uid = getUid();
  await setDoc(doc(db, 'users', uid, 'settings', key), { value });
}

// --- Terms API ---
export async function getCurrentTerm() {
  const uid = getUid();
  const colRef = collection(db, 'users', uid, 'terms');
  const snap = await getDocs(colRef);
  const current = snap.docs.find(doc => doc.data().is_current === 1);
  if (!current) return null;
  return { id: Number(current.id), ...current.data() } as any;
}

export async function createDefaultTerm() {
  const uid = getUid();
  const termData = {
    id: 1,
    name: 'デフォルト学期',
    start_date: '2024-04-01',
    end_date: '2024-08-31',
    is_current: 1
  };
  await setDoc(doc(db, 'users', uid, 'terms', '1'), termData);
  return termData;
}

// --- Classes (授業) API ---
export async function getClasses(termId?: number) {
  const uid = getUid();
  const colRef = collection(db, 'users', uid, 'classes');
  const snap = await getDocs(colRef);
  const classes = snap.docs.map(doc => ({ id: Number(doc.id), ...doc.data() }));
  if (termId !== undefined) {
    return classes.filter((c: any) => c.term_id === termId);
  }
  return classes;
}

export async function saveClass(classData: {
  id?: number | null;
  term_id: number;
  name: string;
  teacher_name?: string | null;
  day_of_week: number;
  period: number;
  url?: string | null;
  room?: string | null;
}) {
  const uid = getUid();
  const classId = classData.id || Date.now();
  const docRef = doc(db, 'users', uid, 'classes', String(classId));
  const data = {
    id: Number(classId),
    term_id: Number(classData.term_id),
    name: classData.name,
    teacher_name: classData.teacher_name || null,
    day_of_week: Number(classData.day_of_week),
    period: Number(classData.period),
    url: classData.url || null,
    room: classData.room || null,
    is_archived: 0
  };
  await setDoc(docRef, data);
  return data;
}

export async function deleteClass(classId: number) {
  const uid = getUid();
  await deleteDoc(doc(db, 'users', uid, 'classes', String(classId)));
}

// --- Task Locations API ---
export async function getTaskLocations() {
  const uid = getUid();
  const colRef = collection(db, 'users', uid, 'task_locations');
  const snap = await getDocs(colRef);
  return snap.docs.map(doc => ({ id: Number(doc.id), ...doc.data() }));
}

export async function saveTaskLocation(location: {
  id?: number | null;
  name: string;
  url?: string | null;
  color?: string | null;
}) {
  const uid = getUid();
  const locId = location.id || Date.now();
  const data = {
    id: Number(locId),
    name: location.name,
    url: location.url || null,
    color: location.color || null,
  };
  await setDoc(doc(db, 'users', uid, 'task_locations', String(locId)), data);
  return data;
}

export async function deleteTaskLocation(locationId: number) {
  const uid = getUid();
  await deleteDoc(doc(db, 'users', uid, 'task_locations', String(locationId)));
}

// --- Period Times API ---
export async function getPeriodTimes() {
  const uid = getUid();
  const colRef = collection(db, 'users', uid, 'period_times');
  const snap = await getDocs(colRef);
  return snap.docs.map(doc => ({ id: Number(doc.id), ...doc.data() }));
}

export async function savePeriodTime(period: number, startTime: string, endTime: string) {
  const uid = getUid();
  const data = {
    id: period,
    period: Number(period),
    start_time: startTime,
    end_time: endTime,
  };
  await setDoc(doc(db, 'users', uid, 'period_times', String(period)), data);
  return data;
}

export async function deletePeriodTime(period: number) {
  const uid = getUid();
  await deleteDoc(doc(db, 'users', uid, 'period_times', String(period)));
}

// --- Tasks API ---
export async function getTasksWithDetails() {
  const uid = getUid();
  const tasksRef = collection(db, 'users', uid, 'tasks');
  const classesRef = collection(db, 'users', uid, 'classes');
  const locationsRef = collection(db, 'users', uid, 'task_locations');

  const [tasksSnap, classesSnap, locationsSnap] = await Promise.all([
    getDocs(tasksRef),
    getDocs(classesRef),
    getDocs(locationsRef)
  ]);

  const classesMap = new Map(classesSnap.docs.map(d => [d.id, d.data()]));
  const locationsMap = new Map(locationsSnap.docs.map(d => [d.id, d.data()]));

  const tasks = tasksSnap.docs.map(doc => {
    const taskData: any = doc.data();
    const classId = taskData.class_id != null ? String(taskData.class_id) : null;
    const locationId = taskData.location_id != null ? String(taskData.location_id) : null;

    const classInfo: any = classId ? classesMap.get(classId) : null;
    const locationInfo: any = locationId ? locationsMap.get(locationId) : null;

    return {
      id: Number(doc.id),
      name: taskData.name,
      due_date: taskData.due_date,
      is_completed: Number(taskData.is_completed),
      format: taskData.format,
      class_id: taskData.class_id != null ? Number(taskData.class_id) : null,
      location_id: taskData.location_id != null ? Number(taskData.location_id) : null,
      class_name: classInfo ? classInfo.name : null,
      location_name: locationInfo ? locationInfo.name : null,
      location_url: locationInfo ? locationInfo.url : null,
      location_color: locationInfo ? locationInfo.color : null,
      details: taskData.details || null,
      is_recurring: Number(taskData.is_recurring),
      created_at: taskData.created_at,
      updated_at: taskData.updated_at
    };
  });

  return tasks.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
}

export async function saveTask(taskData: {
  id?: number | null;
  name: string;
  class_id?: number | null;
  location_id?: number | null;
  format: string;
  created_at: string;
  due_date: string;
  updated_at: string;
  details?: string | null;
  is_completed?: number;
  is_recurring?: number;
  recurrence_interval?: string | null;
}) {
  const uid = getUid();
  const taskId = taskData.id || Date.now();
  const docRef = doc(db, 'users', uid, 'tasks', String(taskId));
  const data = {
    id: Number(taskId),
    name: taskData.name,
    class_id: taskData.class_id != null ? Number(taskData.class_id) : null,
    location_id: taskData.location_id != null ? Number(taskData.location_id) : null,
    format: taskData.format,
    created_at: taskData.created_at,
    due_date: taskData.due_date,
    updated_at: taskData.updated_at,
    details: taskData.details || null,
    is_completed: taskData.is_completed !== undefined ? Number(taskData.is_completed) : 0,
    is_recurring: taskData.is_recurring !== undefined ? Number(taskData.is_recurring) : 0,
    recurrence_interval: taskData.recurrence_interval || 'weekly'
  };
  await setDoc(docRef, data);
  return data;
}

export async function deleteTask(taskId: number) {
  const uid = getUid();
  await deleteDoc(doc(db, 'users', uid, 'tasks', String(taskId)));
  
  // 添付ファイルの削除
  const attachmentsRef = collection(db, 'users', uid, 'task_attachments');
  const snap = await getDocs(attachmentsRef);
  const taskAttachments = snap.docs.filter(d => d.data().task_id === taskId);
  for (const att of taskAttachments) {
    await deleteDoc(doc(db, 'users', uid, 'task_attachments', att.id));
  }
}

export async function deleteTaskAttachments(taskId: number) {
  const uid = getUid();
  const attachmentsRef = collection(db, 'users', uid, 'task_attachments');
  const snap = await getDocs(attachmentsRef);
  const taskAttachments = snap.docs.filter(d => d.data().task_id === taskId);
  for (const att of taskAttachments) {
    await deleteDoc(doc(db, 'users', uid, 'task_attachments', att.id));
  }
}

export async function toggleTaskComplete(taskId: number, isCompleted: number, updatedAt: string) {
  const uid = getUid();
  const docRef = doc(db, 'users', uid, 'tasks', String(taskId));
  await setDoc(docRef, {
    is_completed: Number(isCompleted),
    updated_at: updatedAt
  }, { merge: true });
}

// --- Task Attachments API ---
export async function getTaskAttachments(taskId: number) {
  const uid = getUid();
  const colRef = collection(db, 'users', uid, 'task_attachments');
  const snap = await getDocs(colRef);
  return snap.docs
    .map(doc => ({ id: Number(doc.id), ...doc.data() }))
    .filter((att: any) => att.task_id === taskId);
}

export async function saveTaskAttachment(attachment: {
  id?: number | null;
  task_id: number;
  file_uri: string;
  file_type: string;
}) {
  const uid = getUid();
  const attId = attachment.id || Date.now();
  const data = {
    id: Number(attId),
    task_id: Number(attachment.task_id),
    file_uri: attachment.file_uri,
    file_type: attachment.file_type
  };
  await setDoc(doc(db, 'users', uid, 'task_attachments', String(attId)), data);
  return data;
}

// ユーザーの全データを Firestore から削除
export async function deleteAllUserData(uid: string) {
  const subcollections = [
    'settings',
    'period_times',
    'task_locations',
    'terms',
    'classes',
    'tasks',
    'task_attachments',
  ];

  for (const subCol of subcollections) {
    const colRef = collection(db, 'users', uid, subCol);
    const snapshot = await getDocs(colRef);
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => batch.delete(d.ref));
    if (snapshot.docs.length > 0) {
      await batch.commit();
    }
  }

  // ルートのユーザードキュメント自体も削除
  await deleteDoc(doc(db, 'users', uid));
}

// オフライン時にローカルパスとして保存された添付ファイルを Storage へ一括同期
export async function syncOfflineAttachments() {
  try {
    const uid = getUid();
    const colRef = collection(db, 'users', uid, 'task_attachments');
    const snap = await getDocs(colRef);
    const attachments = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];

    for (const att of attachments) {
      const uri = att.file_uri;
      // http/httpsで始まらないローカルパスを検出
      if (uri && !uri.startsWith('http://') && !uri.startsWith('https://')) {
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const filename = `${Date.now()}_${uri.split('/').pop() || 'file'}`;
          const storagePath = `users/${uid}/attachments/${att.task_id}/${filename}`;
          const storageRef = ref(storage, storagePath);

          await uploadBytes(storageRef, blob);
          const downloadUrl = await getDownloadURL(storageRef);

          await saveTaskAttachment({
            id: Number(att.id),
            task_id: Number(att.task_id),
            file_uri: downloadUrl,
            file_type: att.file_type || ''
          });
          console.log(`✅ ローカル添付ファイルの同期完了: ${att.id} -> ${downloadUrl}`);
        } catch (uploadError) {
          console.warn(`⚠️ 添付ファイル同期スキップ (依然としてオフラインの可能性): ${att.id}`, uploadError);
        }
      }
    }
  } catch (err) {
    console.warn("⚠️ syncOfflineAttachments 失敗:", err);
  }
}
