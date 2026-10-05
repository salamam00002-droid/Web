// ========= إعدادات Firebase =========
// 1) ادخل على console.firebase.google.com وأنشئ مشروع
// 2) Project settings > Your apps > Web app (</>) وانسخ القيم هنا
// لو سيبتها كما هي، التطبيق هيشتغل في "وضع تجريبي" ويحفظ في المتصفح بس.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "YOUR_APP_ID"
};

// إيميل حسابك كأدمن (نفس الإيميل اللي هتنشئه في Firebase Authentication)
export const ADMIN_EMAIL = "admin@example.com";

// بيانات المتجر
export const STORE = {
  name: "سفرية",
  currency: "ج.م",
  whatsapp: "201000000000" // رقمك بصيغة دولية بدون + أو أصفار
};
