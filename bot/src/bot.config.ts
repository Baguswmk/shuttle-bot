/**
 * bot.config.ts
 *
 * Konfigurasi per-instansi platform.
 * Semua nilai diambil dari environment variables sehingga setiap kampus
 * bisa menyesuaikan tanpa mengubah kode sumber.
 *
 * Salin .env.example ke .env dan isi variabel di bawah sesuai kampusmu.
 */
export const botConfig = {
  /** Nama lengkap platform yang ditampilkan di pesan bot */
  name: process.env.BOT_NAME ?? "Shuttle Bot",

  /** Nama kampus (singkatan), misalnya "", "UNDIP", "UGM" */
  campusName: process.env.CAMPUS_NAME ?? "Kampus",

  /** Nama kota / wilayah kampus, misalnya "Semarang", "Yogyakarta" */
  campusCity: process.env.CAMPUS_CITY ?? "Kota",

  /** Contoh lokasi jemput yang ditampilkan sebagai hint di form order */
  pickupExample: process.env.PICKUP_EXAMPLE ?? "Gedung A, Kampus",

  /**
   * Prefix folder Cloudinary untuk upload KTM/selfie.
   * Pisahkan per-instansi agar aset tidak campur antar kampus.
   * Contoh: "unnes-shuttle", "undip-shuttle"
   */
  storagePrefix: process.env.STORAGE_PREFIX ?? "shuttle",

  /**
   * Daftar zona driver yang tersedia.
   * Diisi dari env sebagai string dipisah koma.
   * Contoh: "Sekaran,FT,FIS,FIK,Gerbang Utama"
   */
  zones: (process.env.DRIVER_ZONES ?? "Kampus Utama")
    .split(",")
    .map((z) => z.trim())
    .filter(Boolean),
} as const;
