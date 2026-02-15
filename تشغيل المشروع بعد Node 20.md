# تشغيل المشروع بعد تثبيت Node 20

## الخطوة 1: تنزيل وتثبيت Node 20 (مرة واحدة)

1. ادخل: **https://nodejs.org**
2. حمّل النسخة اللي عليها **LTS** (مكتوب عليها "Recommended") — دي عادة Node 20.
3. ثبّت كالعادة واختر **Add to PATH**.
4. **أغلق Cursor بالكامل وافتحه من جديد** (عشان يتعرّف على Node 20).

---

## الخطوة 2: تشغيل الفرونت من جديد

في Terminal داخل مجلد **frontend** نفّذ:

```powershell
cd c:\Users\hosam\OneDrive\Desktop\Hosam-main\frontend
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue
npm install --legacy-peer-deps
npm start
```

أو: دبل كليك على **تشغيل الفرونت.bat**.

---

## الخطوة 3: الباك اند

في Terminal تاني (مجلد backend):

```powershell
cd c:\Users\hosam\OneDrive\Desktop\Hosam-main\backend
py -m uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

بعدها افتح المتصفح على: **http://localhost:3000**
