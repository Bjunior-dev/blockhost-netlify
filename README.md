# BlockHost — Versi Netlify

Versi ini sudah ditulis ulang supaya jalan di Netlify:
- Backend (Express) dibungkus jadi **satu Netlify Function** (`netlify/functions/api.js`) lewat `serverless-http`.
- Database diganti dari SQLite file ke **Turso** (libSQL) — SQL-nya nyaris sama persis, tapi bisa diakses lewat internet, karena Netlify Functions **tidak punya disk permanen**.
- Frontend (`public/index.html`) **tidak berubah sama sekali** — tetap manggil `/api/...`, dan `netlify.toml` yang meneruskannya ke function.

## 1. Buat database gratis di Turso (tanpa kartu)

1. Buka [turso.tech](https://turso.tech) → sign up gratis (bisa pakai akun GitHub, tidak perlu kartu)
2. Install Turso CLI, atau langsung lewat dashboard web-nya → **Create Database** → kasih nama misal `blockhost`
3. Setelah database dibuat, ambil dua hal ini dari dashboard:
   - **Database URL** (bentuknya `libsql://blockhost-namamu.turso.io`)
   - **Auth Token** (generate lewat tombol "Create Token")

## 2. Setup environment variables

```bash
cp .env.example .env
```
Isi `.env`:
```
DATABASE_URL=libsql://blockhost-namamu.turso.io
DATABASE_AUTH_TOKEN=eyJhbGciOi...
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxx
MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxx
MIDTRANS_IS_PRODUCTION=false
```
(Kalau `DATABASE_URL` dikosongkan, otomatis pakai file lokal `blockhost.db` — cukup untuk coba-coba di komputer sendiri, tapi **wajib diisi Turso** untuk deploy ke Netlify.)

## 3. Coba lokal dulu (opsional)

```bash
npm install
npx netlify dev
```
Buka `http://localhost:8888` — frontend & API sudah nyambung.

## 4. Deploy ke Netlify (gratis, tanpa kartu)

**Cara termudah — drag & drop:**
1. Push folder ini ke repo GitHub, ATAU langsung zip foldernya
2. Buka [app.netlify.com](https://app.netlify.com) → sign up gratis → **Add new site**
3. Kalau dari GitHub: **Import an existing project** → pilih repo ini. Netlify otomatis baca `netlify.toml`.
4. Kalau drag & drop zip: pastikan sudah `npm install` dulu supaya `node_modules` ikut ter-zip (drag & drop tidak menjalankan build otomatis untuk functions dengan dependency eksternal)
5. Sebelum/selama deploy, buka **Site settings → Environment variables**, tambahkan 4 variabel dari `.env` di atas
6. Deploy → dapat URL gratis seperti `https://blockhost-kamu.netlify.app`

## 5. Setel webhook Midtrans

Di Midtrans Dashboard → Settings → Configuration → **Payment Notification URL**, isi:
```
https://blockhost-kamu.netlify.app/api/payments/notification
```

## Catatan penting

- **Cold start**: karena serverless, request pertama setelah lama tidak ada trafik akan sedikit lebih lambat (function "bangun" dulu). Ini normal.
- **Kenapa harus Turso, bukan tetap SQLite file?** Netlify Functions berjalan di container yang di-reset setiap kali (atau di-recycle), jadi file yang ditulis di satu request bisa hilang di request berikutnya. Turso menyimpan datanya di luar, jadi konsisten.
- **Jangan percaya harga dari frontend** — sudah ditentukan di backend lewat `PLANS` di `lib/routes/orders.js`.
- Kontrol server (`toggle`/`delete`) masih **simulasi** — belum terhubung ke server Minecraft sungguhan.
