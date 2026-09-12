// ===================================================
// 우리 반 담벼락 - 백엔드 2 (Firebase Firestore & Google Auth 연동)
// ===================================================

// Firebase SDK 불러오기 (CDN 방식 ES Module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyBqiJIYkrIwEiSslp6HVYA_KlsYTU1IjEg",
  authDomain: "class-wall-212e3.firebaseapp.com",
  projectId: "class-wall-212e3",
  storageBucket: "class-wall-212e3.firebasestorage.app",
  messagingSenderId: "720415233468",
  appId: "1:720415233468:web:2b36d1d34bebfc36eb47b9"
};

// Firebase, Firestore, Auth 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// 현재 로그인한 사용자 정보 (로그아웃 상태면 null)
let currentUser = null;


// ===================================================
// 사용자 로그인 영역 (백엔드 2)
// ===================================================

function updateUserArea() {
  const userArea = document.getElementById("userArea");
  if (!userArea) return;
  userArea.innerHTML = "";

  if (currentUser) {
    const welcome = document.createElement("span");
    welcome.textContent = (currentUser.displayName || "선생님") + "님 환영합니다! ";

    const logoutBtn = document.createElement("button");
    logoutBtn.textContent = "로그아웃";
    logoutBtn.addEventListener("click", async function () {
      try {
        await signOut(auth);
      } catch (err) {
        console.error("로그아웃 실패:", err);
        alert("로그아웃 실패: " + err.message);
      }
    });

    userArea.appendChild(welcome);
    userArea.appendChild(logoutBtn);
  } else {
    const info = document.createElement("span");
    info.textContent = "로그인하면 내 이름으로 메모를 쓰고 삭제할 수 있습니다. ";

    const loginBtn = document.createElement("button");
    loginBtn.textContent = "Google로 로그인";
    loginBtn.addEventListener("click", async function () {
      try {
        await signInWithPopup(auth, provider);
      } catch (err) {
        console.error("로그인 실패:", err);
        alert("로그인 실패: " + err.message);
      }
    });

    userArea.appendChild(info);
    userArea.appendChild(loginBtn);
  }
}

// 로그인 상태 변경 감지
onAuthStateChanged(auth, function (user) {
  currentUser = user;
  updateUserArea();
  render();
});


// ===================================================
// 데이터를 다루는 함수 세 개
// Firestore "memos" 컬렉션을 사용합니다.
// ===================================================

// 메모를 읽어 옵니다.
// 백엔드 1: Firestore에서 가져오며, 순서는 orderBy("createdAt") 으로 맞춥니다.
async function loadMemos() {
  const q = query(collection(db, "memos"), orderBy("createdAt"));
  const querySnapshot = await getDocs(q);
  const list = [];
  querySnapshot.forEach(function (docSnap) {
    list.push({
      id: docSnap.id,
      ...docSnap.data()
    });
  });
  return list;
}

// 메모를 새로 씁니다.
// 백엔드 2: 여기에 "누가 썼는지"(uid, author)를 함께 저장합니다.
async function addMemo(text) {
  if (!currentUser) {
    alert("메모를 작성하려면 먼저 Google 계정으로 로그인해 주세요.");
    return;
  }

  try {
    await addDoc(collection(db, "memos"), {
      text: text,
      createdAt: Date.now(),
      uid: currentUser.uid,
      author: currentUser.displayName || "선생님"
    });
  } catch (err) {
    console.error("메모 저장 실패:", err);
    if (err.code === "permission-denied" || (err.message && err.message.includes("permission"))) {
      alert("메모 저장 실패: Firestore 쓰기 권한이 거부되었습니다.\nFirebase 콘솔의 Firestore Database > '규칙' 탭에서 allow read, write: if true; 로 설정되어 있는지 확인해 주세요.");
    } else {
      alert("메모 저장 실패: " + (err.message || err));
    }
    throw err;
  }
}

// 메모를 지웁니다.
// 백엔드 2: 지금은 누구든 남의 메모를 지울 수 있습니다. 이걸 막는 것이 과제입니다.
async function deleteMemo(id) {
  try {
    await deleteDoc(doc(db, "memos", id));
  } catch (err) {
    console.error("메모 삭제 실패:", err);
    if (err.code === "permission-denied" || (err.message && err.message.includes("permission"))) {
      alert("메모 삭제 실패: Firestore 삭제 권한이 거부되었습니다.\nFirebase 콘솔의 Firestore 규칙을 확인해 주세요.");
    } else {
      alert("메모 삭제 실패: " + (err.message || err));
    }
    throw err;
  }
}


// ===================================================
// 화면 그리기
// ===================================================

let renderCount = 0;
async function render() {
  const currentRender = ++renderCount;
  try {
    const memos = await loadMemos();
    if (currentRender !== renderCount) return;

    const wall = document.getElementById("wall");
    wall.innerHTML = "";

    memos.forEach(function (memo) {
      wall.appendChild(makeMemo(memo));
    });
  } catch (err) {
    console.error("메모 불러오기 실패:", err);
  }
}

// 메모 한 장 만들기
function makeMemo(memo) {
  const div = document.createElement("div");
  div.className = "memo";

  // 백엔드 2: 내가 쓴 메모(또는 작성자 정보가 없는 이전 메모)만 삭제 버튼을 표시합니다
  const canDelete = currentUser && (!memo.uid || memo.uid === currentUser.uid);
  if (canDelete) {
    const del = document.createElement("button");
    del.textContent = "×";
    del.addEventListener("click", async function () {
      try {
        await deleteMemo(memo.id);
        await render();
      } catch (err) {
        // 오류는 deleteMemo에서 처리
      }
    });
    div.appendChild(del);
  }

  const span = document.createElement("span");
  span.textContent = memo.text;
  div.appendChild(span);

  // 작성자 표시 (있을 경우)
  if (memo.author) {
    const authorDiv = document.createElement("div");
    authorDiv.style.fontSize = "12px";
    authorDiv.style.color = "#777";
    authorDiv.style.marginTop = "8px";
    authorDiv.style.textAlign = "right";
    authorDiv.textContent = "- " + memo.author;
    div.appendChild(authorDiv);
  }

  return div;
}


// ===================================================
// 메모 쓰는 칸
// 엔터를 누르면 담벼락에 붙습니다 (줄바꿈은 Shift + 엔터)
// ===================================================

const input = document.getElementById("input");

input.addEventListener("keydown", async function (e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();

    if (!currentUser) {
      alert("메모를 작성하려면 먼저 Google 계정으로 로그인해 주세요.");
      return;
    }

    const text = input.value.trim();
    if (text === "") return;

    try {
      await addMemo(text);
      input.value = "";
      await render();
    } catch (err) {
      // 오류는 addMemo에서 처리
    }
  }
});


// 첫 화면 그리기
updateUserArea();
render();
input.focus();
