-- Perbaikan reguler view v_dashboard_overview
-- Catatan:
-- - Tidak mengubah skema tabel utama
-- - Menghilangkan FULL JOIN ON 1=1 yang menyebabkan cross join besar dan query sangat lambat
-- - Setiap agregasi sekarang dihitung per tabel secara terpisah lalu di-CROSS JOIN (1 baris per tabel)

CREATE OR REPLACE VIEW public.v_dashboard_overview AS
WITH pengiriman_stats AS (
    SELECT
        COUNT(DISTINCT CASE WHEN DATE(dibuat_pada) = CURRENT_DATE THEN id_pengiriman END) AS pengiriman_hari_ini,
        COUNT(
            DISTINCT CASE
                WHEN DATE_TRUNC('month', dibuat_pada) = DATE_TRUNC('month', CURRENT_DATE::timestamp with time zone)
                THEN id_pengiriman
            END
        ) AS pengiriman_bulan_ini,
        COUNT(DISTINCT id_pengiriman) AS total_pengiriman
    FROM pengiriman
),
penagihan_stats AS (
    SELECT
        COUNT(DISTINCT CASE WHEN DATE(dibuat_pada) = CURRENT_DATE THEN id_penagihan END) AS penagihan_hari_ini,
        COALESCE(SUM(
            CASE
                WHEN DATE(dibuat_pada) = CURRENT_DATE THEN total_uang_diterima
            END
        ), 0::numeric) AS pendapatan_hari_ini,
        COUNT(
            DISTINCT CASE
                WHEN DATE_TRUNC('month', dibuat_pada) = DATE_TRUNC('month', CURRENT_DATE::timestamp with time zone)
                THEN id_penagihan
            END
        ) AS penagihan_bulan_ini,
        COALESCE(SUM(
            CASE
                WHEN DATE_TRUNC('month', dibuat_pada) = DATE_TRUNC('month', CURRENT_DATE::timestamp with time zone)
                THEN total_uang_diterima
            END
        ), 0::numeric) AS pendapatan_bulan_ini,
        COUNT(DISTINCT id_penagihan) AS total_penagihan,
        COALESCE(SUM(total_uang_diterima), 0::numeric) AS total_pendapatan
    FROM penagihan
),
setoran_stats AS (
    SELECT
        COALESCE(SUM(
            CASE
                WHEN DATE(dibuat_pada) = CURRENT_DATE THEN total_setoran
            END
        ), 0::numeric) AS setoran_hari_ini,
        COALESCE(SUM(
            CASE
                WHEN DATE_TRUNC('month', dibuat_pada) = DATE_TRUNC('month', CURRENT_DATE::timestamp with time zone)
                THEN total_setoran
            END
        ), 0::numeric) AS setoran_bulan_ini,
        COALESCE(SUM(total_setoran), 0::numeric) AS total_setoran
    FROM setoran
),
active_counts AS (
    SELECT COUNT(*) AS total_sales_aktif
    FROM sales
    WHERE status_aktif = TRUE
),
toko_counts AS (
    SELECT COUNT(*) AS total_toko_aktif
    FROM toko
    WHERE status_toko = TRUE
),
produk_counts AS (
    SELECT COUNT(*) AS total_produk_aktif
    FROM produk
    WHERE status_produk = TRUE
)
SELECT
    CURRENT_DATE AS tanggal_dashboard,
    CURRENT_TIMESTAMP AS waktu_update,
    ps.pengiriman_hari_ini,
    pe.penagihan_hari_ini,
    pe.pendapatan_hari_ini,
    st.setoran_hari_ini,
    pe.pendapatan_hari_ini - st.setoran_hari_ini AS selisih_hari_ini,
    ps.pengiriman_bulan_ini,
    pe.penagihan_bulan_ini,
    pe.pendapatan_bulan_ini,
    st.setoran_bulan_ini,
    pe.pendapatan_bulan_ini - st.setoran_bulan_ini AS selisih_bulan_ini,
    ps.total_pengiriman,
    pe.total_penagihan,
    pe.total_pendapatan,
    st.total_setoran,
    pe.total_pendapatan - st.total_setoran AS selisih_keseluruhan,
    ac.total_sales_aktif,
    tc.total_toko_aktif,
    pc.total_produk_aktif
FROM pengiriman_stats AS ps
CROSS JOIN penagihan_stats AS pe
CROSS JOIN setoran_stats AS st
CROSS JOIN active_counts AS ac
CROSS JOIN toko_counts AS tc
CROSS JOIN produk_counts AS pc;

