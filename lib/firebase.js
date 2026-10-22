import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc 
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBO07TpLj8v72VX37aSTK0YAYY9OOCq2Yo",
  authDomain: "safaqatkitabiya1.firebaseapp.com",
  databaseURL: "https://safaqatkitabiya1-default-rtdb.firebaseio.com",
  projectId: "safaqatkitabiya1",
  storageBucket: "safaqatkitabiya1.firebasestorage.app",
  messagingSenderId: "701445131768",
  appId: "1:701445131768:web:1cabe6241e0c6ab7195a0d",
  measurementId: "G-YM5G83RDXQ"
};

// تهيئة Firebase بأمان لمنع تكرار التشغيل في Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// قائمة البريدات المعتمدة للإدارة المطلقة (Super Admins)
export const SUPER_ADMIN_EMAILS = [
  "safaqatkitabiya@gmail.com",
  "a1hmedrashad@gmail.com"
];

/**
 * فحص دور المستخدم وصلاحياته بناءً على بريده الإلكتروني
 */
export async function checkUserRole(user) {
  if (!user || !user.email) {
    return { role: "guest", isAdmin: false, isStaff: false, permissions: [] };
  }

  const email = user.email.toLowerCase().trim();

  // 1. فحص إذا كان من الإدارة المطلقة
  if (SUPER_ADMIN_EMAILS.includes(email)) {
    return {
      role: "super_admin",
      isAdmin: true,
      isStaff: true,
      permissions: ["all"]
    };
  }

  // 2. فحص إذا كان موظفاً مضافاً من قبل الإدارة في قاعدة البيانات
  try {
    const staffRef = doc(db, "staff", email);
    const staffSnap = await getDoc(staffRef);

    if (staffSnap.exists()) {
      const staffData = staffSnap.data();
      if (staffData.active !== false) {
        return {
          role: "staff",
          isAdmin: false,
          isStaff: true,
          permissions: staffData.permissions || []
        };
      }
    }
  } catch (error) {
    console.error("خطأ أثناء فحص صلاحيات الموظف:", error);
  }

  // 3. مستخدم عادي (عميل)
  return {
    role: "customer",
    isAdmin: false,
    isStaff: false,
    permissions: []
  };
}

/**
 * توليد رقم طلب مميز يبدأ بـ SK متبوعاً بـ 10 أرقام عشوائية غير متكررة
 */
export function generateOrderId() {
  const timestampPart = Date.now().toString().slice(-6); // آخر 6 أرقام من التوقيت بالملي ثانية
  const randomPart = Math.floor(1000 + Math.random() * 9000).toString(); // 4 أرقام عشوائية
  return `SK${timestampPart}${randomPart}`;
}

/**
 * جلب الإعدادات العامة للمتجر (الشعار، رقم الواتساب، تفعيل القرطاسية، مفاتيح الدفع)
 */
export async function getStoreSettings() {
  try {
    const settingsRef = doc(db, "settings", "general");
    const snap = await getDoc(settingsRef);
    if (snap.exists()) {
      return snap.data();
    } else {
      // إعدادات افتراضية أولية في حال لم يتم تعديلها بعد من لوحة التحكم
      const defaultSettings = {
        storeName: "صفقات كتابية",
        logoUrl: "https://i.ibb.co/WNgF31VK/41043.png",
        whatsappNumber: "201000000000",
        showAccessories: false,
        freeShippingThreshold: 500,
        shippingCost: 50,
        paymentGateway: "paymob",
        paymentApiKey: "",
        paymentSecretKey: "",
        paymentPublicKey: "",
        paymentIntegrationId: "",
        enableOnlinePayment: false
      };
      await setDoc(settingsRef, defaultSettings);
      return defaultSettings;
    }
  } catch (error) {
    console.error("خطأ في جلب إعدادات المتجر:", error);
    return {
      storeName: "صفقات كتابية",
      logoUrl: "https://i.ibb.co/WNgF31VK/41043.png",
      whatsappNumber: "201000000000",
      showAccessories: false,
      freeShippingThreshold: 500,
      shippingCost: 50,
      enableOnlinePayment: false
    };
  }
}

export { app, db, auth, googleProvider };
