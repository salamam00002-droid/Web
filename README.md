# سفرية — متجر حقائب سفر

متجر بسيط وحديث (HTML + JS) بيخزن المنتجات والطلبات في Firebase Firestore، ويتنشر مجانًا على GitHub Pages.

## تجربة سريعة
المتصفح بيمنع تشغيل `file://` مع ES modules، فشغّله كده:
```
cd safariya
python3 -m http.server 8000
```
وافتح http://localhost:8000 — من غير ما تعدّل أي إعدادات هيشتغل في **وضع تجريبي** (بيحفظ في المتصفح).
لوحة التحكم: `#admin` وكلمة المرور التجريبية `demo123`.

## ربط Firebase
1. ادخل على https://console.firebase.google.com وأنشئ مشروع.
2. **Build > Firestore Database > Create database** (اختار Production mode).
3. **Build > Authentication > Get started > Email/Password** فعّله، ثم **Users > Add user** وأنشئ حسابك (إيميل + باسورد).
4. **Project settings > Your apps > Web (</>)**، سجّل التطبيق وانسخ الـ config.
5. الصق القيم في `firebase-config.js`، وحط إيميلك في `ADMIN_EMAIL`، ورقم واتساب في `STORE.whatsapp`.
6. في **Firestore > Rules** الصق محتوى `firestore.rules` (بعد ما تغيّر الإيميل جواه لإيميلك) واضغط Publish.
7. افتح `#admin`، سجّل دخول، وضيف منتجاتك.

## الرفع على GitHub Pages
1. أنشئ Repository جديد وارفع كل الملفات.
2. **Settings > Pages > Deploy from a branch > main / root**.
3. بعد دقيقة الموقع هيبقى على `https://USERNAME.github.io/REPO/`.
4. في Firebase: **Authentication > Settings > Authorized domains** ضيف `USERNAME.github.io`.

## ملاحظات
- مفاتيح Firebase في الـ config مش سرية، الحماية الحقيقية من قواعد `firestore.rules`.
- الصور بتتضغط وتتخزن داخل Firestore (مناسبة للمتجر الصغير ومن غير الحاجة لخطة مدفوعة). لو منتجاتك كتير، استخدم روابط صور من خدمة تانية.
- الطلبات بتظهر في لوحة التحكم مع زر واتساب للعميل وتغيير الحالة.
