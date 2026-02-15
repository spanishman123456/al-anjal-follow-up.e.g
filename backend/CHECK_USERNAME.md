# ⚠️ ملاحظة مهمة: حساسية حالة الأحرف في MongoDB

## المشكلة:

في MongoDB Atlas، أرى أن عندك مستخدمين:
- `hossam` (بأحرف صغيرة)
- `Hossam` (بحرف كبير في البداية)

**MongoDB حساس لحالة الأحرف!** يعني:
- `hossam` ≠ `Hossam`
- يجب استخدام نفس الحالة الموجودة في Database Users

---

## الحل:

### 1️⃣ حدد المستخدم الصحيح

من الصورة، أرى مستخدمين. استخدم **أحدهم فقط**:

**الخيار 1:** استخدم `hossam` (بأحرف صغيرة)
```
MONGO_URL=mongodb+srv://hossam:PASSWORD@cluster0.irhqpwj.mongodb.net/?retryWrites=true&w=majority
```

**الخيار 2:** استخدم `Hossam` (بحرف كبير)
```
MONGO_URL=mongodb+srv://Hossam:PASSWORD@cluster0.irhqpwj.mongodb.net/?retryWrites=true&w=majority
```

---

### 2️⃣ تأكد من كلمة السر

1. اضغط **"EDIT"** بجانب المستخدم اللي هتستخدمه
2. تأكد من كلمة السر
3. لو نسيتها، اضغط **"Edit Password"** وضبط كلمة سر جديدة

---

### 3️⃣ تحديث ملف .env

بعد التأكد من اسم المستخدم وكلمة السر:

1. افتح `backend/.env`
2. غيّر السطر:
   ```
   MONGO_URL=mongodb+srv://USERNAME:PASSWORD@cluster0.irhqpwj.mongodb.net/?retryWrites=true&w=majority
   ```
3. ضع:
   - **USERNAME**: نفس الاسم بالضبط (hossam أو Hossam)
   - **PASSWORD**: كلمة السر الصحيحة
   - لو كلمة السر فيها `@`، استبدلها بـ `%40`

---

### 4️⃣ مثال:

لو المستخدم `hossam` وكلمة السر `MyPass@123`:
```
MONGO_URL=mongodb+srv://hossam:MyPass%40123@cluster0.irhqpwj.mongodb.net/?retryWrites=true&w=majority
```

لو المستخدم `Hossam` وكلمة السر `MyPass@123`:
```
MONGO_URL=mongodb+srv://Hossam:MyPass%40123@cluster0.irhqpwj.mongodb.net/?retryWrites=true&w=majority
```

---

### 5️⃣ نصيحة:

**احذف المستخدم الزائد** لتجنب الالتباس:
1. اضغط **"DELETE"** بجانب المستخدم اللي مش محتاجه
2. استخدم مستخدم واحد فقط

أو **استخدم المستخدم الأول** (`hossam` بأحرف صغيرة) لأنه الأبسط.

---

## بعد التحديث:

اختبار الاتصال:
```bash
cd backend
py test_connection.py
```

لو نجح، شغّل السيرفر:
```bash
py -m uvicorn server:app --reload
```
