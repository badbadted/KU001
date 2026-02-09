# 臺南市立新市幼兒園 - 課表系統架構規劃

## 專案概述

戶外體能場班級使用時段預約系統，支援多位老師同時上線編輯課表，資料即時同步至 Firebase Realtime Database。

---

## 一、Firebase 資料結構設計

### 1.1 現行結構（單層）

```
schedule/
  "星期一::8:40-9:40": { className: "大班-太陽班", activity: "大肢體循環" }
  "星期三::10:40-11:40": { className: "中班-月亮班", activity: "球類運動" }
```

**問題：** 每次儲存會覆寫整個 `schedule` 節點（`set(scheduleRef, schedule)`），多人同時編輯時會互相覆蓋。

### 1.2 改進結構（細粒度路徑）

```
ku001/
├── schedule/                          # 課表資料（依儲存格分離）
│   ├── 星期一/
│   │   ├── 8:40-9:40/
│   │   │   ├── className: "大班-太陽班"
│   │   │   ├── activity: "大肢體循環"
│   │   │   ├── updatedBy: "teacher_A"
│   │   │   └── updatedAt: 1707465600000
│   │   ├── 9:40-10:40/
│   │   │   └── ...
│   │   └── 10:40-11:40/
│   │       └── ...
│   ├── 星期二/ ...
│   ├── 星期三/ ...
│   ├── 星期四/ ...
│   └── 星期五/ ...
│
├── users/                             # 使用者資料
│   └── {uid}/
│       ├── displayName: "王老師"
│       ├── role: "teacher"            # teacher | admin
│       ├── color: "#FF9F1C"           # 個人代表色
│       └── lastLogin: 1707465600000
│
├── presence/                          # 線上狀態
│   └── {uid}/
│       ├── online: true
│       ├── displayName: "王老師"
│       └── lastSeen: 1707465600000
│
└── locks/                             # 編輯鎖定
    └── "星期一::8:40-9:40"/
        ├── lockedBy: "teacher_A_uid"
        ├── displayName: "王老師"
        └── lockedAt: 1707465600000
```

### 1.3 資料結構重點

| 節點 | 用途 | 讀寫頻率 |
|------|------|----------|
| `schedule/{day}/{timeSlot}` | 各時段課程資料 | 中（編輯時寫入） |
| `users/{uid}` | 使用者基本資料 | 低（登入時寫入） |
| `presence/{uid}` | 即時線上狀態 | 高（心跳更新） |
| `locks/{slotKey}` | 儲存格編輯鎖定 | 中（開啟/關閉編輯） |

---

## 二、多人共同編輯機制

### 2.1 核心原則

```
單格寫入 (Cell-Level Write)
├── 每個儲存格獨立路徑 → 不同格子的編輯互不干擾
├── 使用 update() 而非 set() → 只更新目標路徑
└── Firebase onValue 監聽 → 自動即時同步
```

### 2.2 編輯流程（含鎖定機制）

```
使用者 A 點擊格子               使用者 B 看到同一格
    │                               │
    ▼                               │
嘗試取得鎖定                        │
(locks/星期一::8:40-9:40)           │
    │                               │
    ├─ 成功 → 開啟編輯 Modal        ▼
    │         │                 嘗試取得鎖定
    │         │                     │
    │         │                 ├─ 失敗 → 顯示
    │         │                 │   "王老師正在編輯中"
    │         │                 │
    │     儲存/取消              │
    │         │                 │
    │         ▼                 │
    │     寫入 schedule          │
    │     釋放鎖定               │
    │                           ▼
    └───────────────────── 鎖定已釋放
                               │
                               ▼
                          可以開始編輯
```

### 2.3 鎖定機制實作

```typescript
// 取得鎖定（使用 Transaction 保證原子性）
async function acquireLock(slotKey: string, uid: string, displayName: string): Promise<boolean> {
  const lockRef = ref(db, `locks/${slotKey}`);
  const result = await runTransaction(lockRef, (current) => {
    if (current === null || isLockExpired(current)) {
      return { lockedBy: uid, displayName, lockedAt: serverTimestamp() };
    }
    return; // 中止交易 = 取得失敗
  });
  return result.committed;
}

// 釋放鎖定
async function releaseLock(slotKey: string, uid: string): Promise<void> {
  const lockRef = ref(db, `locks/${slotKey}`);
  const snapshot = await get(lockRef);
  if (snapshot.val()?.lockedBy === uid) {
    await remove(lockRef);
  }
}

// 鎖定自動過期（防止使用者關閉頁面未釋放）
function isLockExpired(lock: LockData): boolean {
  const LOCK_TIMEOUT = 2 * 60 * 1000; // 2 分鐘
  return Date.now() - lock.lockedAt > LOCK_TIMEOUT;
}
```

### 2.4 單格儲存（取代全覆蓋）

```typescript
// 改進前：覆寫整個 schedule
set(ref(db, 'schedule'), entireScheduleMap);

// 改進後：只寫入單一儲存格
function saveCellSchedule(day: DayOfWeek, timeSlot: TimeSlot, entry: ScheduleEntry | null) {
  const cellRef = ref(db, `schedule/${day}/${timeSlot}`);
  if (entry) {
    return set(cellRef, {
      className: entry.className,
      activity: entry.activity,
      updatedBy: currentUser.uid,
      updatedAt: serverTimestamp()
    });
  } else {
    return remove(cellRef);
  }
}
```

### 2.5 即時監聽（細粒度）

```typescript
// 監聽整個課表（自動接收所有變更）
function onScheduleChange(callback: (schedule: ScheduleData) => void) {
  const scheduleRef = ref(db, 'schedule');
  return onValue(scheduleRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
}

// 監聽鎖定狀態（顯示誰在編輯哪個格子）
function onLocksChange(callback: (locks: Record<string, LockData>) => void) {
  const locksRef = ref(db, 'locks');
  return onValue(locksRef, (snapshot) => {
    callback(snapshot.val() || {});
  });
}
```

---

## 三、使用者身份驗證

### 3.1 建議方案：Firebase Anonymous Auth + 暱稱

```
適合此場景的原因：
├── 使用者為園內老師，不需複雜帳號系統
├── 匿名登入 + 輸入顯示名稱 = 最低使用門檻
├── Firebase Auth 自動管理 session
└── 可日後升級為 Google 登入
```

### 3.2 登入流程

```
開啟網站
    │
    ▼
檢查 localStorage 是否有暱稱
    │
    ├─ 有 → 自動匿名登入，使用儲存的暱稱
    │
    └─ 無 → 顯示歡迎畫面
              │
              ▼
          輸入名稱（例：王老師）
              │
              ▼
          Firebase signInAnonymously()
              │
              ▼
          儲存 uid + displayName
              │
              ▼
          進入課表主頁
```

### 3.3 實作程式碼

```typescript
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

const auth = getAuth(app);

// 匿名登入
async function loginAsTeacher(displayName: string) {
  const credential = await signInAnonymously(auth);
  const uid = credential.user.uid;

  // 儲存使用者資料
  await set(ref(db, `users/${uid}`), {
    displayName,
    role: 'teacher',
    lastLogin: serverTimestamp()
  });

  localStorage.setItem('teacherName', displayName);
  return uid;
}
```

---

## 四、線上狀態顯示（Presence）

### 4.1 Firebase Presence 系統

```typescript
import { onDisconnect, serverTimestamp } from 'firebase/database';

function setupPresence(uid: string, displayName: string) {
  const presenceRef = ref(db, `presence/${uid}`);

  // 設定上線狀態
  set(presenceRef, {
    online: true,
    displayName,
    lastSeen: serverTimestamp()
  });

  // 斷線時自動設為離線
  onDisconnect(presenceRef).set({
    online: false,
    displayName,
    lastSeen: serverTimestamp()
  });

  // 斷線時自動釋放所有鎖定
  const userLocksQuery = query(ref(db, 'locks'), orderByChild('lockedBy'), equalTo(uid));
  onValue(userLocksQuery, (snapshot) => {
    snapshot.forEach((child) => {
      onDisconnect(child.ref).remove();
    });
  });
}
```

### 4.2 UI 顯示

```
Header 區域：
┌──────────────────────────────────────────┐
│ 🏫 臺南市立新市幼兒園                     │
│ 戶外體能場班級使用時段                     │
│                                          │
│ 目前在線：🟢 王老師  🟢 李老師  🟢 陳老師   │
└──────────────────────────────────────────┘

格子被鎖定時：
┌─────────────┐
│ ✏️ 王老師    │
│ 正在編輯...  │
│ (淡灰遮罩)   │
└─────────────┘
```

---

## 五、Firebase Security Rules

```json
{
  "rules": {
    "schedule": {
      "$day": {
        "$timeSlot": {
          ".read": true,
          ".write": "auth != null"
        }
      }
    },
    "users": {
      "$uid": {
        ".read": true,
        ".write": "auth.uid === $uid"
      }
    },
    "presence": {
      "$uid": {
        ".read": true,
        ".write": "auth.uid === $uid"
      }
    },
    "locks": {
      "$slotKey": {
        ".read": true,
        ".write": "auth != null && (!data.exists() || data.child('lockedBy').val() === auth.uid || data.child('lockedAt').val() < now - 120000)"
      }
    }
  }
}
```

**規則說明：**
- `schedule`：已登入者可寫入，所有人可讀
- `users`：只能寫入自己的資料
- `presence`：只能更新自己的線上狀態
- `locks`：已登入者可取得空鎖，只有擁有者可釋放，超過 2 分鐘自動視為過期可覆蓋

---

## 六、TypeScript 型別定義（更新）

```typescript
// types.ts

export type DayOfWeek = '星期一' | '星期二' | '星期三' | '星期四' | '星期五';
export type TimeSlot = '8:40-9:40' | '9:40-10:40' | '10:40-11:40';

export interface ScheduleEntry {
  className: string;
  activity: string;
  updatedBy?: string;       // 最後編輯者 uid
  updatedAt?: number;       // 最後編輯時間
}

export interface UserProfile {
  displayName: string;
  role: 'teacher' | 'admin';
  color?: string;
  lastLogin: number;
}

export interface PresenceData {
  online: boolean;
  displayName: string;
  lastSeen: number;
}

export interface LockData {
  lockedBy: string;         // uid
  displayName: string;
  lockedAt: number;
}

// 課表資料結構（巢狀）
export type ScheduleData = {
  [day in DayOfWeek]?: {
    [time in TimeSlot]?: ScheduleEntry;
  };
};
```

---

## 七、元件架構（更新）

```
index.tsx
└── App.tsx
    ├── AuthGuard.tsx                   # 新增：登入檢查
    │   └── LoginScreen.tsx             # 新增：輸入暱稱畫面
    ├── Header.tsx                      # 新增：含線上使用者列表
    │   └── OnlineUsers.tsx             # 新增：線上狀態顯示
    ├── ScheduleTable.tsx               # 修改：顯示鎖定狀態
    │   └── ScheduleCell.tsx            # 新增：單一格子元件
    │       └── LockIndicator.tsx       # 新增：鎖定指示器
    └── EditModal.tsx                   # 修改：加入鎖定/解鎖
```

---

## 八、實作優先順序

### Phase 1 - 核心改造（必要）

| 順序 | 項目 | 說明 |
|------|------|------|
| 1 | 資料結構遷移 | `schedule` 從扁平 key 改為巢狀路徑 |
| 2 | 單格寫入 | `saveSchedule()` 改為 `saveCellSchedule()` |
| 3 | Firebase Security Rules | 部署基本讀寫規則 |

### Phase 2 - 使用者識別

| 順序 | 項目 | 說明 |
|------|------|------|
| 4 | 匿名登入 | Firebase Anonymous Auth + 暱稱輸入 |
| 5 | 使用者資料儲存 | `users/{uid}` 節點 |

### Phase 3 - 多人協作

| 順序 | 項目 | 說明 |
|------|------|------|
| 6 | 鎖定機制 | Transaction-based cell locking |
| 7 | 線上狀態 | Presence 系統 + onDisconnect |
| 8 | UI 提示 | 鎖定指示、線上使用者列表 |

### Phase 4 - 強化（選用）

| 順序 | 項目 | 說明 |
|------|------|------|
| 9 | 編輯歷史 | 記錄每次修改，支援回溯 |
| 10 | 通知提示 | 其他人修改時顯示 toast 通知 |
| 11 | 管理員模式 | admin 角色可重置課表、管理使用者 |

---

## 九、Firebase 服務改寫範例

```typescript
// services/firebaseService.ts（改寫後）

import { initializeApp } from 'firebase/app';
import {
  getDatabase, ref, set, get, remove, update,
  onValue, runTransaction, onDisconnect,
  serverTimestamp, query, orderByChild, equalTo
} from 'firebase/database';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { ScheduleEntry, DayOfWeek, TimeSlot, LockData } from '../types';

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// ──── 課表操作 ────

export function saveCellSchedule(
  day: DayOfWeek,
  timeSlot: TimeSlot,
  entry: ScheduleEntry | null
): Promise<void> {
  const cellRef = ref(db, `schedule/${day}/${timeSlot}`);
  if (entry) {
    return set(cellRef, {
      ...entry,
      updatedBy: auth.currentUser?.uid,
      updatedAt: serverTimestamp()
    });
  }
  return remove(cellRef);
}

export function onScheduleChange(callback: (data: any) => void): () => void {
  return onValue(ref(db, 'schedule'), (snap) => callback(snap.val() || {}));
}

// ──── 鎖定操作 ────

export async function acquireLock(slotKey: string): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  const lockRef = ref(db, `locks/${slotKey}`);
  const result = await runTransaction(lockRef, (current) => {
    if (!current || Date.now() - current.lockedAt > 120000) {
      return {
        lockedBy: user.uid,
        displayName: localStorage.getItem('teacherName') || '未知',
        lockedAt: Date.now()
      };
    }
    if (current.lockedBy === user.uid) return current;
    return undefined; // 中止
  });

  if (result.committed) {
    onDisconnect(lockRef).remove(); // 斷線自動釋放
  }
  return result.committed;
}

export async function releaseLock(slotKey: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) return;
  const lockRef = ref(db, `locks/${slotKey}`);
  const snap = await get(lockRef);
  if (snap.val()?.lockedBy === user.uid) {
    await remove(lockRef);
  }
}

export function onLocksChange(callback: (locks: Record<string, LockData>) => void): () => void {
  return onValue(ref(db, 'locks'), (snap) => callback(snap.val() || {}));
}

// ──── Presence ────

export function setupPresence(displayName: string): void {
  const user = auth.currentUser;
  if (!user) return;
  const presRef = ref(db, `presence/${user.uid}`);
  set(presRef, { online: true, displayName, lastSeen: serverTimestamp() });
  onDisconnect(presRef).set({ online: false, displayName, lastSeen: serverTimestamp() });
}

export function onPresenceChange(callback: (data: any) => void): () => void {
  return onValue(ref(db, 'presence'), (snap) => callback(snap.val() || {}));
}
```

---

## 十、注意事項

1. **資料遷移**：從舊的 `"星期一::8:40-9:40"` key 格式遷移到 `schedule/星期一/8:40-9:40` 巢狀路徑，需寫一次性遷移腳本
2. **鎖定超時**：設定 2 分鐘自動過期，避免使用者關閉瀏覽器後鎖定卡住
3. **離線處理**：`onDisconnect` 會在伺服器端偵測斷線後自動執行，確保鎖定被釋放
4. **Firebase 免費額度**：Realtime Database 免費方案提供 1GB 儲存、10GB/月傳輸，此應用規模綽綽有餘
5. **中文路徑**：Firebase Realtime Database 支援 UTF-8 key，星期一~五可直接作為路徑
