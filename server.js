// Khai báo các thư viện cần thiết cho ứng dụng
const express = require('express'); // Framework tạo server web
const { Pool } = require('pg');   // Thư viện kết nối cơ sở dữ liệu PostgreSQL
const cors = require('cors');     // Thư viện cho phép gọi API từ các tên miền khác nhau
const path = require('path');     // Thư viện xử lý đường dẫn thư mục

const app = express();
const port = process.env.PORT || 3000; // Lấy cổng chạy từ hệ thống hoặc mặc định là 3000

// Cấu hình middleware cơ bản cho Express
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Cho phép chạy file HTML tĩnh trong thư mục public

// Khởi tạo kết nối đến cơ sở dữ liệu PostgreSQL trên Render thông qua biến môi trường
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ==========================================
// 1. QUẢN LÝ SỐ NGƯỜI ĐANG ONLINE (REAL-TIME)
// ==========================================
let activeUsers = new Set(); // Dùng Set để lưu danh sách IP không bị trùng lặp

// API trả về số lượng người đang online hiện tại cho giao diện web
app.get('/api/online-count', (req, res) => {
    res.json({ online: activeUsers.size });
});

// Middleware tự động ghi nhận lượt truy cập của người dùng
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    activeUsers.add(ip);
    
    // Tự động xóa IP khỏi danh sách online sau 5 phút không tương tác
    setTimeout(() => {
        activeUsers.delete(ip);
    }, 5 * 60 * 1000);
    
    next();
});

// ==========================================
// 2. HỆ THỐNG CACHE BỘ NHỚ (GIẢM TẢI CHO DATABASE)
// ==========================================
const cacheMemory = new Map(); // Lưu trữ kết quả truy vấn tạm thời trong RAM của server
const CACHE_TTL = 60 * 1000;   // Thời gian tồn tại của cache là 1 phút

// Hàm lấy dữ liệu từ cache nếu có sẵn
function getCache(key) {
    const item = cacheMemory.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) { // Nếu hết hạn thì xóa cache cũ
        cacheMemory.delete(key);
        return null;
    }
    return item.data;
}

// Hàm lưu kết quả mới vào cache
function setCache(key, data) {
    cacheMemory.set(key, { data, expiry: Date.now() + CACHE_TTL });
}

// ==========================================
// 3. HÀM XỬ LÝ DỮ LIỆU CSV (Đọc dòng dữ liệu thô từ Google Sheets)
// ==========================================
function parseCSVRow(rowText) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < rowText.length; i++) {
        const char = rowText[i];
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) {
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
        } else current += char;
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return result;
}

// ==========================================
// 4. HÀM ĐỒNG BỘ TOÀN BỘ DỮ LIỆU TỪ GOOGLE SHEETS VÀO POSTGRESQL
// ==========================================
async function dongBoToanBoDuLieu() {
    const client = await pool.connect();
    try {
        // Đồng bộ danh sách liệt sĩ ngoài nghĩa trang
        await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;');
        await client.query(`
            CREATE TABLE danh_sach_liet_si (
                id_db SERIAL PRIMARY KEY,
                so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
                hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, noi_hy_sinh TEXT, tieu_su TEXT
            );
        `);
        const resNgoai = await fetch('https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0');
        if (resNgoai.ok) {
            const csvNgoai = await resNgoai.text();
            const rowsNgoai = csvNgoai.split(/\r?\n/).slice(1);
            for (let row of rowsNgoai) {
                if (!row || row.trim() === '') continue;
                const cols = parseCSVRow(row);
                // Bỏ qua dòng nếu cột Họ và tên bị trống
                if (!cols[1] || cols[1].trim() === '') continue; 
                const values = Array.from({ length: 10 }, (_, i) => cols[i] || "");
                await client.query(`INSERT INTO danh_sach_liet_si (so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, values);
            }
        }

        // Đồng bộ danh sách liệt sĩ trong đền từ các GID khác nhau
        await client.query('DROP TABLE IF EXISTS danh_sach_trong_den CASCADE;');
        await client.query(`
            CREATE TABLE danh_sach_trong_den (
                id_db SERIAL PRIMARY KEY,
                so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
                nam_hy_sinh TEXT, don_vi TEXT, danh_hieu TEXT, 
                board TEXT, "row" TEXT, col TEXT, tieu_su TEXT
            );
        `);
        
        const shrineGids = ['0','164496961', '2030583334', '520701169', '1389251803', '2097412071', '256922227', '1621758412', '1896480892'];

        for (const gid of shrineGids) {
            const resTrong = await fetch(`https://docs.google.com/spreadsheets/d/18KqyTFMNp_1hm4hQObfc7b8HtmsLLD6jkievCvYkF4U/export?format=csv&gid=${gid}`);
            if (resTrong.ok) {
                const csvTrong = await resTrong.text();
                const rowsTrong = csvTrong.split(/\r?\n/).slice(1); 
                for (let row of rowsTrong) {
                    if (!row || row.trim() === '') continue;
                    const cols = parseCSVRow(row);
                    
                    // 🛑 BỎ QUA CÁC DÒNG TRỐNG TÊN TRÊN GOOGLE SHEETS
                    if (!cols[1] || cols[1].trim() === '') continue; 

                    const values = [
                        cols[0] || "", cols[1] || "", cols[2] || "", cols[3] || "",  
                        cols[4] || "", cols[5] || "", cols[9] || "", cols[10] || "", 
                        cols[6] || "", cols[7] || "", cols[8] || ""    
                    ];
                    await client.query(`
                        INSERT INTO danh_sach_trong_den 
                        (so_tt, ho_va_ten, nam_sinh, que_quan, nam_hy_sinh, don_vi, danh_hieu, board, "row", col, tieu_su) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, values);
                }
            }
        }
        console.log("✅ Đồng bộ dữ liệu thành công!");
    } catch (err) {
        console.error("❌ Lỗi đồng bộ:", err.message);
    } finally {
        client.release(); // Giải phóng kết nối client sau khi xong
    }
}

// ==========================================
// 5. CÁC API TRUY VẤN VÀ TÌM KIẾM DỮ LIỆU
// ==========================================

// API danh sách ngoài nghĩa trang (Hỗ trợ tìm kiếm không dấu + lọc bỏ dòng trống)
app.get('/api/martyrs', async (req, res) => {
    try {
        let { name, home } = req.query;
        let conditions = [];
        let values = [];
        let paramIndex = 1;

        let baseQuery = `
            SELECT id_db AS id, so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo 
            FROM danh_sach_liet_si
            WHERE ho_va_ten IS NOT NULL AND TRIM(ho_va_ten) != ''
        `;

        if (name && name.trim() !== '') {
            conditions.push(`translate(LOWER(ho_va_ten), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd') LIKE translate(LOWER($${paramIndex}), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd')`);
            values.push(`%${name.trim()}%`);
            paramIndex++;
        }
        if (home && home.trim() !== '') {
            conditions.push(`translate(LOWER(que_quan), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd') LIKE translate(LOWER($${paramIndex}), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd')`);
            values.push(`%${home.trim()}%`);
            paramIndex++;
        }

        if (conditions.length > 0) {
            baseQuery += ` AND ` + conditions.join(' AND ');
        }

        baseQuery += ` ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST`;

        const result = await pool.query(baseQuery, values);
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server" }); 
    }
});

// API danh sách trong đền (Hỗ trợ Cache RAM, tìm kiếm không dấu, lọc bỏ dòng trống)
app.get('/api/shrine-martyrs', async (req, res) => {
    try {
        // Kiểm tra xem query này đã được lưu trong bộ nhớ đệm (Cache) chưa
        const cacheKey = JSON.stringify(req.query);
        const cachedData = getCache(cacheKey);
        if (cachedData) {
            return res.json(cachedData); // Trả về ngay lập tức từ RAM, không cần hỏi Database
        }

        let { name, birth, home, deathYear } = req.query;
        let conditions = [];
        let values = [];
        let paramIndex = 1;

        // Câu lệnh SQL gốc kết hợp lọc bỏ ngay lập tức các dòng tên bị trống
        let baseQuery = `
            SELECT id_db AS id, ho_va_ten AS name, nam_sinh AS birth, que_quan AS home, 
                   nam_hy_sinh AS "deathYear", board, "row", col 
            FROM danh_sach_trong_den
            WHERE ho_va_ten IS NOT NULL AND TRIM(ho_va_ten) != ''
        `;

        if (name && name.trim() !== '') {
            conditions.push(`translate(LOWER(ho_va_ten), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd') LIKE translate(LOWER($${paramIndex}), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd')`);
            values.push(`%${name.trim()}%`);
            paramIndex++;
        }
        if (birth && birth.trim() !== '') {
            conditions.push(`nam_sinh LIKE $${paramIndex}`);
            values.push(`%${birth.trim()}%`);
            paramIndex++;
        }
        if (home && home.trim() !== '') {
            conditions.push(`translate(LOWER(que_quan), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd') LIKE translate(LOWER($${paramIndex}), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd')`);
            values.push(`%${home.trim()}%`);
            paramIndex++;
        }
        if (deathYear && deathYear.trim() !== '') {
            conditions.push(`nam_hy_sinh LIKE $${paramIndex}`);
            values.push(`%${deathYear.trim()}%`);
            paramIndex++;
        }

        if (conditions.length > 0) {
            baseQuery += ` AND ` + conditions.join(' AND ');
        }

        baseQuery += ` ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST`;

        const result = await pool.query(baseQuery, values);
        
        // Lưu kết quả tìm kiếm vào Cache RAM để phục vụ các request trùng lặp tiếp theo
        setCache(cacheKey, result.rows);
        
        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Đền Thờ" }); 
    }
});

// API lấy chi tiết thông tin một liệt sĩ theo ID trong đền
app.get('/api/shrine-martyrs/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id_db AS id, ho_va_ten AS name, nam_sinh AS birth, que_quan AS home, 
                   nam_hy_sinh AS "deathYear", don_vi AS unit, danh_hieu AS "title", 
                   board, "row", col, tieu_su AS bio 
            FROM danh_sach_trong_den WHERE id_db = $1
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Lỗi chi tiết" }); }
});

// API đồng bộ dữ liệu thủ công qua Webhook hoặc đường dẫn web
app.post('/api/sync-webhook', async (req, res) => {
    await dongBoToanBoDuLieu();
    res.json({ message: "Đồng bộ thành công!" });
});

app.get('/api/sync-data', async (req, res) => {
    await dongBoToanBoDuLieu();
    res.json({ message: "Đã cập nhật dữ liệu!" });
});

// Khởi động server lắng nghe tại cổng đã định nghĩa
app.listen(port, async () => { 
    console.log(`Server đang chạy tại cổng ${port}`); 
});
