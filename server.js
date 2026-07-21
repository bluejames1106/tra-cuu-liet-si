// --- KHỞI TẠO THƯ VIỆN & CẤU HÌNH BAN ĐẦU ---
const express = require('express'); // Nhập framework Express để xây dựng ứng dụng web và API server
const { Pool } = require('pg'); // Nhập thư viện pg (Pool) để kết nối và thao tác với cơ sở dữ liệu PostgreSQL
const cors = require('cors'); // Nhập middleware CORS cho phép các tên miền khác nhau gọi API tới server
const path = require('path'); // Nhập thư viện path của Node.js để xử lý đường dẫn thư mục và tập tin
const http = require('http'); // Nhập thư viện http gốc để tạo HTTP server chạy chung với Express
const { Server } = require('socket.io'); // Nhập thư viện Socket.io để làm tính năng đếm người online thời gian thực

const app = express(); // Khởi tạo ứng dụng Express
const server = http.createServer(app); // Tạo HTTP server dựa trên ứng dụng Express
const io = new Server(server); // Gắn Socket.io vào HTTP server

const port = process.env.PORT || 3000; // Đặt cổng chạy server, lấy từ biến môi trường của cloud hoặc mặc định là 3000

app.use(cors()); // Cho phép tất cả các nguồn gửi yêu cầu CORS tới server này
app.use(express.json()); // Cấu hình middleware để server tự động đọc và phân tích dữ liệu dạng JSON từ request gửi lên
app.use(express.static(path.join(__dirname, 'public'))); // Cấu hình thư mục chứa các tệp tĩnh (HTML, CSS, JS frontend) nằm ở thư mục 'public'


// --- BỘ NHỚ TẠM VÀ CHỐNG SPAM (GIẢM TẢI DATABASE) ---
const searchCache = new Map(); // Lưu tạm kết quả tìm kiếm vào RAM để khi nhiều người tìm cùng 1 từ khóa sẽ trả về ngay mà không cần query lại DB
const requestTracker = new Map(); // Theo dõi số lượng request từ từng địa chỉ IP để chống spam

// Middleware chặn spam: Giới hạn nếu 1 IP gửi quá 15 request/giây sẽ tạm thời bị chặn để bảo vệ Database
app.use('/api/', (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    
    if (!requestTracker.has(ip)) {
        requestTracker.set(ip, { count: 1, startTime: now });
    } else {
        const data = requestTracker.get(ip);
        if (now - data.startTime < 1000) {
            data.count++;
            if (data.count > 15) {
                return res.status(429).json({ error: "Bạn đang thao tác quá nhanh, vui lòng từ từ!" });
            }
        } else {
            data.count = 1;
            data.startTime = now;
        }
    }
    next();
});


// --- XỬ LÝ SỐ LƯỢNG NGƯỜI ONLINE THỰC TẾ ---
let activeUsers = 0; // Biến đếm số lượng người đang kết nối

io.on('connection', (socket) => {
    activeUsers++; // Khi có 1 trình duyệt mới mở trang web kết nối vào
    io.emit('update-online-count', activeUsers); // Phát số lượng online mới nhất tới toàn bộ client

    socket.on('disconnect', () => {
        activeUsers = Math.max(0, activeUsers - 1); // Khi có người tắt tab hoặc thoát web
        io.emit('update-online-count', activeUsers); // Cập nhật lại số online giảm đi
    });
});


// --- 1. CẤU HÌNH KẾT NỐI POSTGRESQL ---
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Chuỗi kết nối cơ sở dữ liệu PostgreSQL lấy từ biến môi trường
    ssl: { rejectUnauthorized: false }, // Bật bảo mật SSL cho phép kết nối an toàn với cơ sở dữ liệu trên cloud (Render, Supabase...)
    max: 30, // Tăng giới hạn số lượng kết nối đồng thời trong hàng đợi lên 30 để chịu tải tốt hơn
    idleTimeoutMillis: 30000, // Thời gian tự động đóng kết nối thừa nếu không dùng tới
    connectionTimeoutMillis: 2000, // Thời gian chờ tối đa khi kết nối vào database
});


// --- HÀM HỖ TRỢ XỬ LÝ CHUỖI VÀ TÌM KIẾM ---
const unaccentSQL = (column) => `translate(LOWER(${column}), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd')`;

// Hàm xử lý từ khóa tìm kiếm: tách các từ ra để tìm linh hoạt theo nhiều thứ tự từ khác nhau
function formatSearchPattern(text) {
    if (!text || !text.trim()) return '';
    const words = text.trim().split(/\s+/);
    return `%${words.join('%')}%`;
}

// Hàm cắt chuỗi file CSV dòng dữ liệu thô từ Google Sheets thành các cột riêng biệt
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


// --- 2. HÀM ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS ---
async function dongBoToanBoDuLieu() {
    const client = await pool.connect(); // Lấy một kết nối từ pool
    try {
        console.log("⏳ Đang bắt đầu tải dữ liệu từ Google Sheets...");
        
        // Tạo lại bảng chứa danh sách mộ phần liệt sĩ bên ngoài
        await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;');
        await client.query(`
            CREATE TABLE danh_sach_liet_si (
                id_db SERIAL PRIMARY KEY,
                so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
                hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, noi_hy_sinh TEXT, tieu_su TEXT
            );
        `);
        // Tải dữ liệu CSV từ Google Sheets mộ phần
        const resNgoai = await fetch('https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0');
        if (resNgoai.ok) {
            const csvNgoai = await resNgoai.text();
            const rowsNgoai = csvNgoai.split(/\r?\n/).slice(1);
            for (let row of rowsNgoai) {
                if (!row || row.trim() === '') continue;
                const cols = parseCSVRow(row);
                if (!cols[1] || cols[1].trim() === '') continue;
                const values = Array.from({ length: 10 }, (_, i) => cols[i] || "");
                await client.query(`INSERT INTO danh_sach_liet_si (so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, values);
            }
        }

        // Tạo lại bảng danh sách liệt sĩ trong đền thờ
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

        // Lần lượt tải dữ liệu từ các trang (gid) của Google Sheets đền thờ
        for (const gid of shrineGids) {
            const resTrong = await fetch(`https://docs.google.com/spreadsheets/d/18KqyTFMNp_1hm4hQObfc7b8HtmsLLD6jkievCvYkF4U/export?format=csv&gid=${gid}`);
            if (resTrong.ok) {
                const csvTrong = await resTrong.text();
                const rowsTrong = csvTrong.split(/\r?\n/).slice(1); 
                for (let row of rowsTrong) {
                    if (!row || row.trim() === '') continue;
                    const cols = parseCSVRow(row);
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

        // TẠO CHỈ MỤC (INDEX) TỐC ĐỘ CAO: Giúp database tìm kiếm tên cực nhanh khi hàng nghìn người tra cứu cùng lúc
        await client.query(`CREATE INDEX IF NOT EXISTS idx_liet_si_ten ON danh_sach_liet_si (ho_va_ten);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_den_ten ON danh_sach_trong_den (ho_va_ten);`);

        searchCache.clear(); // Xóa sạch bộ nhớ tạm khi vừa đồng bộ dữ liệu mới xong
        console.log("✅ Đã hoàn tất đồng bộ toàn bộ dữ liệu và tối ưu Index!");
    } catch (err) {
        console.error("❌ Lỗi đồng bộ:", err.message);
    } finally {
        client.release(); // Trả lại kết nối cho pool
    }
}


// --- 3. API TRA CỨU: MỘ PHẦN (Có tích hợp Cache và tối ưu tìm kiếm) ---
app.get('/api/martyrs', async (req, res) => {
    try {
        const cacheKey = JSON.stringify(req.query);
        if (searchCache.has(cacheKey)) {
            return res.json(searchCache.get(cacheKey)); // Nếu từ khóa này đã được tìm trước đó, lấy ngay kết quả từ RAM trả về
        }

        const { name, birth, home, area, row, grave } = req.query;
        let sql = `SELECT id_db AS id, so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo FROM danh_sach_liet_si WHERE 1=1`;
        const values = []; 
        let paramIndex = 1;
        
        // Thêm các điều kiện tìm kiếm động nếu người dùng có nhập thông tin
        if (name && name.trim()) { sql += ` AND ${unaccentSQL('ho_va_ten')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(name)); paramIndex++; }
        if (birth && birth.trim()) { sql += ` AND nam_sinh ILIKE $${paramIndex}`; values.push(`%${birth.trim()}%`); paramIndex++; }
        if (home && home.trim()) { sql += ` AND ${unaccentSQL('que_quan')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(home)); paramIndex++; }
        if (area && area.trim()) { sql += ` AND ${unaccentSQL('hang')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(area)); paramIndex++; }
        if (row && row.trim()) { sql += ` AND ${unaccentSQL('hang')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(row)); paramIndex++; }
        if (grave && grave.trim()) { sql += ` AND so_mo ILIKE $${paramIndex}`; values.push(`%${grave.trim()}%`); paramIndex++; }
        
        sql += " ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST";
        const result = await pool.query(sql, values); // Thực thi câu lệnh truy vấn xuống cơ sở dữ liệu
        
        searchCache.set(cacheKey, result.rows); // Lưu kết quả vào bộ nhớ tạm
        setTimeout(() => searchCache.delete(cacheKey), 30000); // Sau 30 giây tự động xóa cache này đi để cập nhật mới nếu cần

        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Mộ phần" }); 
    }
});


// --- 4. API TRA CỨU: TRONG ĐỀN THỜ ---
app.get('/api/shrine-martyrs', async (req, res) => {
    try {
        const cacheKey = 'shrine_' + JSON.stringify(req.query);
        if (searchCache.has(cacheKey)) {
            return res.json(searchCache.get(cacheKey));
        }

        const { name, birth, home, deathYear } = req.query;
        let sql = `
            SELECT id_db AS id, ho_va_ten AS name, nam_sinh AS birth, que_quan AS home, 
                   nam_hy_sinh AS "deathYear", board, "row", col 
            FROM danh_sach_trong_den WHERE 1=1
        `;
        const values = []; 
        let paramIndex = 1;
        
        if (name && name.trim()) { sql += ` AND ${unaccentSQL('ho_va_ten')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(name)); paramIndex++; }
        if (birth && birth.trim()) { sql += ` AND nam_sinh ILIKE $${paramIndex}`; values.push(`%${birth.trim()}%`); paramIndex++; }
        if (home && home.trim()) { sql += ` AND ${unaccentSQL('que_quan')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(home)); paramIndex++; }
        if (deathYear && deathYear.trim()) { sql += ` AND nam_hy_sinh ILIKE $${paramIndex}`; values.push(`%${deathYear.trim()}%`); paramIndex++; }
        
        sql += " ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST";
        const result = await pool.query(sql, values);
        
        searchCache.set(cacheKey, result.rows);
        setTimeout(() => searchCache.delete(cacheKey), 30000);

        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Đền Thờ" }); 
    }
});


// --- 5. API XEM CHI TIẾT 1 MỘ PHẦN ---
app.get('/api/martyrs/:id', async (req, res) => {
    try {
        const result = await pool.query(`SELECT * FROM danh_sach_liet_si WHERE id_db = $1`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy" });
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Lỗi chi tiết mộ phần" }); }
});


// --- 6. API XEM CHI TIẾT 1 LIỆT SĨ TRONG ĐỀN THỜ ---
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
    } catch (err) { res.status(500).json({ error: "Lỗi chi tiết đền thờ" }); }
});


// --- CÁC API ĐỒNG BỘ DỮ LIỆU THỦ CÔNG / WEBHOOK ---
app.get('/api/sync-data', async (req, res) => {
    await dongBoToanBoDuLieu();
    res.json({ message: "Đã cập nhật dữ liệu mới nhất từ Google Sheets!" });
});

app.post('/api/sync-webhook', async (req, res) => {
    try {
        await dongBoToanBoDuLieu();
        res.status(200).json({ message: "Đồng bộ thành công!" });
    } catch (err) {
        res.status(500).json({ error: "Lỗi hệ thống khi đồng bộ" });
    }
});


// --- 7. KHỞI ĐỘNG SERVER ---
server.listen(port, async () => { 
    console.log(`🚀 Server đang chạy mượt mà tại cổng ${port}`); 
    await dongBoToanBoDuLieu(); // Tự động đồng bộ dữ liệu ngay khi server vừa khởi động xong
});
