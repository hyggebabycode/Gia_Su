# Sổ dạy học

App web nhỏ cho gia sư quản lý buổi đi dạy và tính lương theo tháng.

## Chạy local

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Deploy Vercel

1. Đẩy project lên GitHub.
2. Vào Vercel, chọn `Add New Project`.
3. Import repo này.
4. Giữ mặc định:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. Bấm `Deploy`.

Dữ liệu hiện được lưu bằng `localStorage` trên trình duyệt, phù hợp dùng cá nhân và không cần backend.
