/* =====================================================
   WARUNG VIRUS - script.js

   Daftar isi:
   1. Data & state (variabel yang berubah-ubah)
   2. Fungsi bantu
   3. Riwayat pesanan (localStorage)
   4. Menu & keranjang
   5. Lembar bawah: kerangka (buka, tutup, kepala)
   6. Lembar bawah: isi tiap layar
   7. Pesanan & pembayaran
   8. QRIS & hitung mundur
   9. Event (klik, submit, dll)
   10. Jalankan pertama kali
   ===================================================== */


/* ---------- 1. DATA & STATE ---------- */

// Daftar menu. id harus unik.
const menu = [
    { id: 1, nama: 'Nasi goreng', harga: 15000, jenis: 'makanan', ikon: '🍛', gambar: 'nasigoreng.png' },
    { id: 2, nama: 'Mie goreng',  harga: 14000, jenis: 'makanan', ikon: '🍜', gambar: 'miegoreng.png' },
    { id: 3, nama: 'Ayam kremes', harga: 18000, jenis: 'makanan', ikon: '🍗', gambar: 'ayamkremes.png' },
    { id: 4, nama: 'Lemon tea',   harga: 6000,  jenis: 'minuman', ikon: '🍋', gambar: 'lemontea.png' },
    { id: 5, nama: 'Es teh',      harga: 4000,  jenis: 'minuman', ikon: '🍹', gambar: 'esteh.png' },
    { id: 6, nama: 'Es jeruk',    harga: 6000,  jenis: 'minuman', ikon: '🍊', gambar: 'esjeruk.png' }
];

const keranjang = {};   // { idMenu: jumlah }
let filter = 'semua';   // 'semua' | 'makanan' | 'minuman'

// Layar yang sedang terbuka di lembar bawah (null = tertutup):
// 'keranjang' | 'form' | 'bayar' | 'qris' | 'selesai' | 'tunai' | 'riwayat'
let tampilan = null;

let dataPemesan = { nama: '', alamat: '', catatan: '' };
let struk = null;       // pesanan yang sedang diproses
let metode = 'qris';    // 'qris' | 'tunai'

// QRIS
const QRIS_GAMBAR = '';          // isi nama file gambar QRIS asli (kosong = QR demo)
const DURASI_BAYAR = 5 * 60;     // 5 menit
let pewaktu = null;
let sisaDetik = 0;

// Riwayat pesanan
const KUNCI_RIWAYAT = 'virus-riwayat';
let riwayat = muatRiwayat();

// Tab di layar "Pesanan saya":
// 'aktif'   = pesanan tunai yang masih menunggu dibayar di kasir
// 'selesai' = riwayat pesanan yang sudah lunas (QRIS otomatis, tunai setelah ditandai lunas)
let tabRiwayat = 'aktif';

// Urutan tombol "Kembali": dari layar ini kembali ke layar itu
// (layar QRIS tidak punya tombol kembali karena pesanan sudah tersimpan)
const balik = { form: 'keranjang', bayar: 'form' };


/* ---------- 2. FUNGSI BANTU ---------- */

const el = (id) => document.getElementById(id);

const rupiah = (angka) => 'Rp' + angka.toLocaleString('id-ID');

const cariMenu = (id) => menu.find((m) => m.id === id);

// Mencegah teks dari user dibaca sebagai HTML
function esc(teks) {
    const d = document.createElement('div');
    d.textContent = teks;
    return d.innerHTML;
}

// Hitung total harga & jumlah item di keranjang
function hitung() {
    let total = 0;
    let jumlahItem = 0;

    for (const id in keranjang) {
        total += cariMenu(Number(id)).harga * keranjang[id];
        jumlahItem += keranjang[id];
    }
    return { total, jumlahItem };
}


/* ---------- 3. RIWAYAT PESANAN ---------- */

function muatRiwayat() {
    try {
        const data = JSON.parse(localStorage.getItem(KUNCI_RIWAYAT));
        return Array.isArray(data) ? data : [];
    } catch (err) {
        return [];
    }
}

function simpanRiwayat() {
    try {
        localStorage.setItem(KUNCI_RIWAYAT, JSON.stringify(riwayat));
    } catch (err) {
        // penyimpanan tidak tersedia, abaikan
    }
}

// Angka di tombol "Pesanan saya" = jumlah pesanan yang belum lunas
function perbaruiLencanaRiwayat() {
    const l = el('jumlah-riwayat');
    const aktif = riwayat.filter((r) => r.status === 'menunggu').length;

    l.textContent = aktif;
    l.hidden = aktif === 0;
}

// Tambah pesanan baru ke paling atas riwayat
function simpanPesanan(metodeBayar, status) {
    riwayat = muatRiwayat();
    riwayat.unshift({
        ...struk,
        metode: metodeBayar,
        status,                          // 'lunas' | 'menunggu'
        waktu: new Date().toISOString()
    });
    simpanRiwayat();
    perbaruiLencanaRiwayat();
}

// Kode unik, contoh: VRS-4821
function buatKode() {
    const ada = muatRiwayat();
    let kode;
    do {
        kode = 'VRS-' + Math.floor(1000 + Math.random() * 9000);
    } while (ada.some((r) => r.kode === kode));
    return kode;
}

function waktuPesanan(iso) {
    return new Date(iso).toLocaleString('id-ID', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
}


/* ---------- 4. MENU & KERANJANG ---------- */

// Tombol - 1 + (dipakai di kartu menu dan keranjang)
function stepper(id) {
    return `
        <div class="jumlah">
            <button type="button" data-aksi="kurang" data-id="${id}" aria-label="Kurangi">−</button>
            <span>${keranjang[id]}</span>
            <button type="button" data-aksi="tambah" data-id="${id}" aria-label="Tambah">+</button>
        </div>`;
}

// FUNGSI GAMBAR: mengambil file dari folder gambar/.
// Jika file tidak ditemukan, otomatis diganti emoji.
function gambarMenu(m) {
    return `
        <img src="gambar/${m.gambar}" alt="${m.nama}" loading="lazy"
             onerror="this.style.display='none'; this.parentElement.textContent='${m.ikon}'">`;
}

// Menggambar semua kartu menu sesuai filter
function tampilkanMenu() {
    const wadah = el('daftar-menu');
    wadah.innerHTML = '';

    for (const m of menu) {
        if (filter !== 'semua' && m.jenis !== filter) continue;

        const tombolAksi = keranjang[m.id]
            ? stepper(m.id)
            : `<button type="button" class="tambah" data-aksi="tambah" data-id="${m.id}">Tambah</button>`;

        const kartu = document.createElement('article');
        kartu.className = 'kartu-menu';
        kartu.innerHTML = `
            <div class="foto">${gambarMenu(m)}</div>
            <h3>${m.nama}</h3>
            <p class="harga">${rupiah(m.harga)}</p>
            <div class="aksi">${tombolAksi}</div>`;

        wadah.appendChild(kartu);
    }
}

// Perbarui bar keranjang di bawah layar
function tampilkanBar(animasi) {
    const { total, jumlahItem } = hitung();
    const lencana = el('lencana');

    el('bar').hidden = jumlahItem === 0;
    lencana.textContent = jumlahItem;
    el('total-bar').textContent = rupiah(total);

    // Animasi lencana "loncat" saat item bertambah
    if (animasi) {
        lencana.classList.remove('loncat');
        void lencana.offsetWidth;   // memaksa browser mengulang animasi
        lencana.classList.add('loncat');
    }
}

function ubahJumlah(id, perubahan) {
    keranjang[id] = (keranjang[id] || 0) + perubahan;
    if (keranjang[id] <= 0) delete keranjang[id];

    tampilkanMenu();
    tampilkanBar(perubahan > 0);

    // Jika sedang membuka keranjang, ikut diperbarui
    if (tampilan === 'keranjang') {
        hitung().jumlahItem === 0 ? tutupLembar() : tampilkanLembar();
    }
}

function kosongkanKeranjang() {
    for (const id in keranjang) delete keranjang[id];
    tampilkanMenu();
    tampilkanBar(false);
}


/* ---------- 5. LEMBAR BAWAH: KERANGKA ---------- */

function bukaLembar(nama) {
    tampilan = nama;
    tampilkanLembar();
}

function tutupLembar() {
    clearInterval(pewaktu);
    tampilan = null;
    el('lembar').hidden = true;
    el('lapisan').hidden = true;
}

// Bagian atas lembar: judul + tombol tutup (+ tombol kembali jika perlu)
function kepala(judul, adaKembali) {
    const kiri = adaKembali
        ? '<button type="button" class="tombol-teks" data-aksi="kembali">‹ Kembali</button>'
        : `<h2>${judul}</h2>`;

    return `
        <div class="lembar-kepala">
            ${kiri}
            <button type="button" class="tutup" data-aksi="tutup" aria-label="Tutup">✕</button>
        </div>
        ${adaKembali ? `<h2>${judul}</h2>` : ''}`;
}

// Potongan HTML yang dipakai di banyak layar
function ringkasanTotal() {
    return `
        <div class="baris-total">
            <span>Total</span>
            <strong>${rupiah(hitung().total)}</strong>
        </div>`;
}

function barisItem(item) {
    return item.map((i) => `
        <li>
            <span>${i.jumlah}× ${i.nama}</span>
            <span>${rupiah(i.subtotal)}</span>
        </li>`).join('');
}

function duaTombol() {
    return `
        <div class="dua-tombol">
            <button type="button" class="tombol-sekunder" data-aksi="riwayat">Lihat pesanan</button>
            <button type="button" class="tombol-utama" data-aksi="ulang">Pesan lagi</button>
        </div>`;
}

function infoPemesan() {
    return `<p class="redup">Atas nama ${esc(struk.nama)} · ${esc(struk.alamat)}</p>`;
}


/* ---------- 6. LEMBAR BAWAH: ISI TIAP LAYAR ----------
   Setiap fungsi hanya mengembalikan teks HTML. */

function layarKeranjang() {
    let daftar = '';

    for (const id in keranjang) {
        const m = cariMenu(Number(id));
        daftar += `
            <li>
                <div class="ikon">${gambarMenu(m)}</div>
                <div class="info">
                    <strong>${m.nama}</strong>
                    <small>${rupiah(m.harga * keranjang[id])}</small>
                </div>
                ${stepper(id)}
            </li>`;
    }

    return `
        ${kepala('Keranjang')}
        <ul class="daftar">${daftar}</ul>
        ${ringkasanTotal()}
        <button type="button" class="tombol-utama" data-aksi="checkout">Checkout</button>`;
}

function layarForm() {
    return `
        ${kepala('Data pemesan', true)}
        <form id="form-pesan">
            <label class="isian">
                Nama
                <input name="nama" required autocomplete="name" value="${esc(dataPemesan.nama)}">
            </label>

            <label class="isian">
                Nomor meja atau alamat antar
                <input name="alamat" required value="${esc(dataPemesan.alamat)}">
            </label>

            <label class="isian">
                Catatan (boleh kosong)
                <textarea name="catatan">${esc(dataPemesan.catatan)}</textarea>
            </label>

            ${ringkasanTotal()}
            <button type="submit" class="tombol-utama">Pilih pembayaran</button>
        </form>`;
}

// Satu pilihan metode pembayaran (radio)
function opsiMetode(nilai, judul, keterangan) {
    return `
        <label class="metode-opsi">
            <input type="radio" name="metode" value="${nilai}" ${metode === nilai ? 'checked' : ''}>
            <span class="metode-isi">
                <strong>${judul}</strong>
                <small>${keterangan}</small>
            </span>
        </label>`;
}

function layarBayar() {
    return `
        ${kepala('Pilih pembayaran', true)}
        <div class="metode">
            ${opsiMetode('qris', 'QRIS', 'Pindai kode dengan e-wallet atau m-banking')}
            ${opsiMetode('tunai', 'Tunai', 'Bayar langsung di kasir')}
        </div>
        ${ringkasanTotal()}
        <button type="button" class="tombol-utama" data-aksi="lanjutbayar">Lanjutkan</button>`;
}

function layarQris() {
    return `
        ${kepala('Bayar dengan QRIS')}
        <div class="qris">
            <div class="qris-kotak" id="qris-kotak"></div>
            <p class="redup">Buka e-wallet atau m-banking, lalu pindai kode ini.</p>

            <div class="baris-total">
                <span>Total bayar</span>
                <strong>${rupiah(struk.total)}</strong>
            </div>

            <p class="qris-waktu">Bayar dalam <strong id="qris-waktu">05:00</strong></p>
            <p class="nota">Nota akan diberikan oleh pelayan.</p>
            <p class="redup">Pesanan sudah tersimpan di "Pesanan saya". Kamu bisa menutup layar ini dan membayar nanti.</p>
            <button type="button" class="tombol-utama" data-aksi="sudahbayar">Saya sudah bayar</button>
        </div>`;
}

function layarSelesai() {
    return `
        <div class="sukses">
            <h2>Pembayaran berhasil</h2>
            <div class="kode">${struk.kode}</div>
            ${infoPemesan()}
            <p class="nota">Nota akan diberikan oleh pelayan.</p>
            <ul class="daftar struk">${barisItem(struk.item)}</ul>
            ${struk.catatan ? `<p class="redup">Catatan: ${esc(struk.catatan)}</p>` : ''}

            <div class="baris-total">
                <span>Total dibayar</span>
                <strong>${rupiah(struk.total)}</strong>
            </div>
            ${duaTombol()}
        </div>`;
}

function layarTunai() {
    return `
        <div class="sukses">
            <h2>Silakan menuju kasir</h2>
            <div class="kode besar">${struk.kode}</div>
            <p class="nota">Sebutkan kode ini ke kasir untuk membayar.</p>
            ${infoPemesan()}
            <ul class="daftar struk">${barisItem(struk.item)}</ul>

            <div class="baris-total">
                <span>Bayar di kasir</span>
                <strong>${rupiah(struk.total)}</strong>
            </div>
            ${duaTombol()}
        </div>`;
}

// Satu kartu di daftar "Pesanan saya"
function kartuPesanan(r) {
    const label = {
        lunas: 'Lunas',
        batal: 'Dibatalkan',
        menunggu: r.metode === 'qris' ? 'Menunggu pembayaran QRIS' : 'Menunggu bayar di kasir'
    }[r.status];

    // Tombol hanya untuk pesanan yang masih menunggu, sesuai metode bayarnya
    let tombol = '';
    if (r.status === 'menunggu') {
        const kode = `data-kode="${r.kode}"`;

        tombol = r.metode === 'qris'
            ? `<button type="button" class="tombol-sekunder bahaya" data-aksi="batalkan" ${kode}>Batalkan</button>
               <button type="button" class="tombol-utama" data-aksi="tampilkanqris" ${kode}>Tampilkan QRIS</button>`
            : `<button type="button" class="tombol-sekunder bahaya" data-aksi="batalkan" ${kode}>Batalkan pesanan</button>
               <button type="button" class="tombol-utama" data-aksi="tandailunas" ${kode}>Tandai lunas</button>`;

        tombol = `<div class="dua-tombol">${tombol}</div>`;
    }

    return `
        <article class="pesanan">
            <div class="pesanan-atas">
                <strong>${r.kode}</strong>
                <span class="status ${r.status}">${label}</span>
            </div>

            <small class="redup">
                ${waktuPesanan(r.waktu)} · ${r.metode === 'qris' ? 'QRIS' : 'Tunai'} · ${esc(r.nama)}
                ${r.waktuLunas ? `<br>Lunas pada ${waktuPesanan(r.waktuLunas)}` : ''}
            </small>

            <ul class="daftar struk">${barisItem(r.item)}</ul>

            <div class="pesanan-total">
                <span>Total</span>
                <strong>${rupiah(r.total)}</strong>
            </div>

            ${tombol}
        </article>`;
}

function layarRiwayat() {
    riwayat = muatRiwayat();

    // Pisahkan pesanan: yang belum lunas (aktif) dan yang sudah lunas (riwayat)
    const aktif = riwayat.filter((r) => r.status === 'menunggu');
    const selesai = riwayat.filter((r) => r.status !== 'menunggu');   // lunas + dibatalkan
    const lunas = riwayat.filter((r) => r.status === 'lunas');
    const daftar = tabRiwayat === 'aktif' ? aktif : selesai;

    // Pesanan yang dibatalkan tidak dihitung sebagai uang masuk
    const totalLunas = lunas.reduce((jumlah, r) => jumlah + r.total, 0);

    const pesanKosong = tabRiwayat === 'aktif'
        ? 'Tidak ada pesanan yang menunggu pembayaran.'
        : 'Belum ada riwayat pesanan. Pesanan yang lunas atau dibatalkan akan muncul di sini.';

    return `
        ${kepala('Pesanan saya')}

        <div class="tab">
            <button type="button" class="${tabRiwayat === 'aktif' ? 'aktif' : ''}"
                    data-aksi="tab" data-tab="aktif">Menunggu bayar (${aktif.length})</button>
            <button type="button" class="${tabRiwayat === 'selesai' ? 'aktif' : ''}"
                    data-aksi="tab" data-tab="selesai">Riwayat (${selesai.length})</button>
        </div>

        ${tabRiwayat === 'selesai' ? `
            <div class="ringkas">
                <div><small>Sudah dibayar</small><strong>${rupiah(totalLunas)}</strong></div>
                <div><small>Pesanan lunas</small><strong>${lunas.length}</strong></div>
            </div>` : ''}

        ${daftar.length
            ? daftar.map(kartuPesanan).join('')
            : `<p class="redup kosong">${pesanKosong}</p>`}`;
}

// Daftar layar: nama layar -> fungsi yang membuat isinya
const layar = {
    keranjang: layarKeranjang,
    form: layarForm,
    bayar: layarBayar,
    qris: layarQris,
    selesai: layarSelesai,
    tunai: layarTunai,
    riwayat: layarRiwayat
};

// Menggambar layar yang aktif ke dalam lembar
function tampilkanLembar() {
    const lembar = el('lembar');

    lembar.hidden = false;
    el('lapisan').hidden = false;
    lembar.innerHTML = layar[tampilan]();

    // Hal yang baru bisa dilakukan setelah HTML tampil
    if (tampilan === 'form') {
        lembar.querySelector('input[name="nama"]').focus();
    }
    if (tampilan === 'qris') {
        gambarQris();
        mulaiHitungMundur();
    }
}


/* ---------- 7. PESANAN & PEMBAYARAN ---------- */

// Dipanggil saat form data pemesan dikirim
function buatPesanan(form) {
    const f = new FormData(form);

    dataPemesan = {
        nama: f.get('nama').trim(),
        alamat: f.get('alamat').trim(),
        catatan: f.get('catatan').trim()
    };

    struk = {
        kode: buatKode(),
        ...dataPemesan,
        total: hitung().total,
        item: Object.keys(keranjang).map((id) => {
            const m = cariMenu(Number(id));
            return {
                nama: m.nama,
                jumlah: keranjang[id],
                subtotal: m.harga * keranjang[id]
            };
        })
    };

    bukaLembar('bayar');
}

// Mengubah status satu pesanan: 'lunas' atau 'batal'
function ubahStatus(kode, status) {
    riwayat = muatRiwayat();

    const pesanan = riwayat.find((r) => r.kode === kode);
    if (!pesanan) return;

    pesanan.status = status;
    if (status === 'lunas') pesanan.waktuLunas = new Date().toISOString();

    simpanRiwayat();
    perbaruiLencanaRiwayat();
}

// Tunai: disimpan dulu sebagai "menunggu", dibayar di kasir
function pesanTunai() {
    simpanPesanan('tunai', 'menunggu');
    tabRiwayat = 'aktif';
    kosongkanKeranjang();
    bukaLembar('tunai');
}

// QRIS: disimpan dulu sebagai "menunggu", lalu QR ditampilkan
function pesanQris() {
    simpanPesanan('qris', 'menunggu');
    tabRiwayat = 'aktif';
    kosongkanKeranjang();
    bukaLembar('qris');
}

// Menampilkan QR lagi untuk pesanan QRIS yang belum dibayar
function tampilkanQrisLagi(kode) {
    struk = muatRiwayat().find((r) => r.kode === kode);
    if (struk) bukaLembar('qris');
}

// Tombol "Saya sudah bayar" di layar QRIS -> lunas, masuk Riwayat
function selesaiBayar() {
    clearInterval(pewaktu);
    ubahStatus(struk.kode, 'lunas');
    tabRiwayat = 'selesai';
    bukaLembar('selesai');
}

// Tombol "Tandai lunas" -> pindah ke tab Riwayat
function tandaiLunas(kode) {
    ubahStatus(kode, 'lunas');
    tabRiwayat = 'selesai';
    tampilkanLembar();
}

// Tombol "Batalkan" -> status batal, pindah ke tab Riwayat
function batalkanPesanan(kode) {
    if (!confirm('Batalkan pesanan ' + kode + '?')) return;

    ubahStatus(kode, 'batal');
    tabRiwayat = 'selesai';
    tampilkanLembar();
}


/* ---------- 8. QRIS & HITUNG MUNDUR ---------- */

function gambarQris() {
    const kotak = el('qris-kotak');

    if (QRIS_GAMBAR) {
        kotak.innerHTML = `<img src="${QRIS_GAMBAR}" alt="QRIS Warung Virus">`;
        return;
    }

    // QR demo dibuat otomatis oleh library qrcode.js
    new QRCode(kotak, {
        text: `VIRUS-DEMO|${struk.kode}|${struk.total}`,
        width: 200,
        height: 200,
        colorDark: '#0b2a8a',
        colorLight: '#ffffff'
    });
}

function mulaiHitungMundur() {
    clearInterval(pewaktu);
    sisaDetik = DURASI_BAYAR;

    pewaktu = setInterval(() => {
        sisaDetik--;

        const tulisan = el('qris-waktu');

        // Layar sudah berganti, hentikan
        if (!tulisan) {
            clearInterval(pewaktu);
            return;
        }

        // Waktu habis
        if (sisaDetik <= 0) {
            clearInterval(pewaktu);
            kedaluwarsa();
            return;
        }

        const menit = String(Math.floor(sisaDetik / 60)).padStart(2, '0');
        const detik = String(sisaDetik % 60).padStart(2, '0');
        tulisan.textContent = `${menit}:${detik}`;
    }, 1000);
}

function kedaluwarsa() {
    el('lembar').querySelector('.qris').innerHTML = `
        <p><strong>Waktu pembayaran habis.</strong></p>
        <p class="redup">Buat kode baru untuk melanjutkan pesanan ini, atau pilih bayar tunai di kasir.</p>
        <button type="button" class="tombol-utama" data-aksi="qrisulang">Buat kode baru</button>`;
}


/* ---------- 9. EVENT ----------
   Satu pendengar klik untuk semua tombol.
   Tombol punya atribut data-aksi="nama", lalu dicari di objek `aksi`. */

const aksi = {
    tambah:      (t) => ubahJumlah(Number(t.dataset.id), 1),
    kurang:      (t) => ubahJumlah(Number(t.dataset.id), -1),
    buka:        () => bukaLembar('keranjang'),
    checkout:    () => bukaLembar('form'),
    kembali:     () => bukaLembar(balik[tampilan] || 'keranjang'),
    lanjutbayar: () => (metode === 'qris' ? pesanQris() : pesanTunai()),
    tampilkanqris: (t) => tampilkanQrisLagi(t.dataset.kode),
    batalkan:    (t) => batalkanPesanan(t.dataset.kode),
    sudahbayar:  () => selesaiBayar(),
    qrisulang:   () => bukaLembar('qris'),
    riwayat:     () => bukaLembar('riwayat'),
    tab:         (t) => { tabRiwayat = t.dataset.tab; tampilkanLembar(); },
    tandailunas: (t) => tandaiLunas(t.dataset.kode),
    tutup:       () => tutupLembar(),
    ulang: () => {
        struk = null;
        tutupLembar();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
};

document.addEventListener('click', (e) => {
    // 1. Tombol filter menu
    const chip = e.target.closest('[data-filter]');
    if (chip) {
        filter = chip.dataset.filter;
        document.querySelectorAll('.chip').forEach((c) => {
            c.classList.toggle('aktif', c === chip);
        });
        tampilkanMenu();
        return;
    }

    // 2. Tombol lain
    const tombol = e.target.closest('[data-aksi]');
    if (!tombol) return;

    // Lapisan gelap hanya menutup jika yang diklik lapisannya sendiri
    if (tombol.id === 'lapisan' && e.target !== tombol) return;

    const jalankan = aksi[tombol.dataset.aksi];
    if (jalankan) jalankan(tombol);
});

// Pilihan metode pembayaran
document.addEventListener('change', (e) => {
    if (e.target.name === 'metode') metode = e.target.value;
});

// Form data pemesan
document.addEventListener('submit', (e) => {
    if (e.target.id === 'form-pesan') {
        e.preventDefault();
        buatPesanan(e.target);
    }
});

// Tombol Esc menutup lembar
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tampilan) tutupLembar();
});

// Riwayat berubah dari tab lain -> ikut diperbarui
window.addEventListener('storage', (e) => {
    if (e.key !== KUNCI_RIWAYAT) return;

    riwayat = muatRiwayat();
    perbaruiLencanaRiwayat();

    if (tampilan === 'riwayat') tampilkanLembar();
});


/* ---------- 10. JALANKAN PERTAMA KALI ---------- */

tampilkanMenu();
tampilkanBar(false);
perbaruiLencanaRiwayat();
