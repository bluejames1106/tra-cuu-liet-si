const express = require('express'); // Nhập framework Express để xây dựng ứng dụng web và API server
const { Pool } = require('pg'); // Nhập thư viện pg (Pool) để kết nối và thao tác với cơ sở dữ liệu PostgreSQL
const cors = require('cors'); // Nhập middleware CORS cho phép các tên miền khác nhau gọi API tới server
const path = require('path'); // Nhập thư viện path của Node.js để xử lý đường dẫn thư mục và tập tin

const app = express(); // Khởi tạo ứng dụng Express
const port = process.env.PORT || 3000; // Đặt cổng chạy server, lấy từ biến môi trường hoặc mặc định là cổng 3000

app.use(cors()); // Cho phép tất cả các nguồn gửi yêu cầu CORS tới server này
app.use(express.json()); // Cấu hình middleware để server tự động đọc và phân tích dữ liệu dạng JSON từ request gửi lên
app.use(express.static(path.join(__dirname, 'public'))); // Cấu hình thư mục chứa các tệp tĩnh (HTML, CSS, JS frontend) nằm ở thư mục 'public'

// ĐẾM SỐ NGƯỜI ĐANG ONLINE TRỰC TUYẾN
let onlineUsers = new Set(); // Khởi tạo một tập hợp (Set) để lưu trữ danh sách các địa chỉ IP của người dùng đang trực tuyến (giúp loại bỏ trùng lặp)

// 1. CẤU HÌNH KẾT NỐI POSTGRESQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Chuỗi kết nối cơ sở dữ liệu PostgreSQL lấy từ biến môi trường
    ssl: { rejectUnauthorized: false } // Bật bảo mật SSL cho phép kết nối an toàn với cơ sở dữ liệu trên cloud (như Render, Heroku)
});

// HÀM CHUYỂN ĐỔI CHUỖI TIẾNG VIỆT SANG KHÔNG DẤU VÀ VIẾT THƯỜNG TRONG SQL
const unaccentSQL = (column) => `translate(LOWER(${column}), 'áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ', 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd')`;

// HÀM XỬ LÝ TỪ KHÓA TÌM KIẾM LINH HOẠT (HỖ TRỢ TÌM THIẾU CHỮ / TỪ LÓT)
function formatSearchPattern(text) {
    if (!text || !text.trim()) return ''; // Nếu từ khóa rỗng hoặc chỉ chứa khoảng trắng thì trả về chuỗi rỗng
    // Tách các từ theo khoảng trắng và nối lại bằng dấu %
    // Ví dụ: "Nguyễn An" -> "%nguyen%an%"
    const words = text.trim().split(/\s+/);
    return `%${words.join('%')}%`;
}

// HÀM PHÂN TÍCH MỘT DÒNG DỮ LIỆU CSV (XỬ LÝ DẤU PHẨY VÀ DẤU NGOẶC KÉP CHUẨN XÁC)
function parseCSVRow(rowText) {
    const result = []; // Mảng chứa các cột dữ liệu sau khi tách
    let current = ''; // Biến lưu giá trị tạm thời của cột hiện tại
    let inQuotes = false; // Cờ kiểm tra xem có đang nằm bên trong cặp dấu ngoặc kép hay không
    for (let i = 0; i < rowText.length; i++) { // Duyệt qua từng ký tự của dòng CSV
        const char = rowText[i];
        if (char === '"') inQuotes = !inQuotes; // Đảo trạng thái cờ khi gặp dấu ngoặc kép
        else if (char === ',' && !inQuotes) { // Nếu gặp dấu phẩy và không nằm trong ngoặc kép thì kết thúc một cột
            result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
            current = '';
        } else current += char; // Cộng dồn ký tự vào cột hiện tại
    }
    result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"')); // Thêm cột cuối cùng vào mảng kết quả
    return result;
}

// 2. HÀM ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS
async function dongBoToanBoDuLieu() {
    const client = await pool.connect(); // Lấy một kết nối client từ pool cơ sở dữ liệu
    try {
        console.log("⏳ Đang bắt đầu tải dữ liệu từ Google Sheets...");
        
        // --- ĐỒNG BỘ MỘ PHẦN ---
        await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;'); // Xóa bảng liệt sĩ cũ nếu đã tồn tại để làm mới hoàn toàn
        // Tạo cấu trúc bảng lưu danh sách mộ phần liệt sĩ
        await client.query(`
            CREATE TABLE danh_sach_liet_si (
                id_db SERIAL PRIMARY KEY,
                so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
                hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, noi_hy_sinh TEXT, tieu_su TEXT
            );
        `);
        // Tải dữ liệu CSV từ Google Sheets của phần mộ ngoại
        const resNgoai = await fetch('https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0');
        if (resNgoai.ok) {
            const csvNgoai = await resNgoai.text(); // Lấy nội dung dưới dạng chuỗi văn bản CSV
            const rowsNgoai = csvNgoai.split(/\r?\n/).slice(1); // Cắt nội dung thành từng dòng và bỏ qua dòng tiêu đề đầu tiên
            for (let row of rowsNgoai) { // Vòng lặp duyệt qua từng dòng dữ liệu
                if (!row || row.trim() === '') continue; // Bỏ qua nếu dòng trống
                const cols = parseCSVRow(row); // Phân tích dòng CSV thành mảng các cột
                if (!cols[1] || cols[1].trim() === '') continue; // Bỏ qua nếu cột họ và tên bị trống
                const values = Array.from({ length: 10 }, (_, i) => cols[i] || ""); // Chuẩn hóa đủ 10 cột giá trị
                // Thực hiện câu lệnh chèn dữ liệu vào bảng danh_sach_liet_si
                await client.query(`INSERT INTO danh_sach_liet_si (so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, values);
            }
        }

        // --- ĐỒNG BỘ ĐỀN THỜ ---
        await client.query('DROP TABLE IF EXISTS danh_sach_trong_den CASCADE;'); // Xóa bảng đền thờ cũ nếu tồn tại
        // Tạo cấu trúc bảng lưu danh sách liệt sĩ trong đền thờ
        await client.query(`
            CREATE TABLE danh_sach_trong_den (
                id_db SERIAL PRIMARY KEY,
                so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
                nam_hy_sinh TEXT, don_vi TEXT, danh_hieu TEXT, 
              	board TEXT, "row" TEXT, col TEXT, tieu_su TEXT
            );
        `);
        
        // Danh sách các mã GID của các bảng tính Google Sheets liên quan đến đền thờ
        const shrineGids = ['0','164496961', '2030583334', '520701169', '1389251803', '2097412071', '256922227', '1621758412', '1896480892'];

        let boardIndex = 1; // Biến đếm theo dõi thứ tự bảng (board)

        for (const gid of shrineGids) { // Duyệt qua từng GID của đền thờ
            const resTrong = await fetch(`https://docs.google.com/spreadsheets/d/18KqyTFMNp_1hm4hQObfc7b8HtmsLLD6jkievCvYkF4U/export?format=csv&gid=${gid}`);
            if (resTrong.ok) {
                const csvTrong = await resTrong.text(); // Lấy nội dung CSV của đền thờ
                const rowsTrong = csvTrong.split(/\r?\n/).slice(1); // Cắt lấy danh sách dòng, bỏ qua dòng tiêu đề
                for (let row of rowsTrong) {
                    if (!row || row.trim() === '') continue; // Bỏ qua dòng trống
                    const cols = parseCSVRow(row); // Tách cột dữ liệu dòng CSV
                    if (!cols[1] || cols[1].trim() === '') continue; // Bỏ qua nếu không có tên
                    
                    // Ánh xạ dữ liệu từ các cột CSV vào các biến tương ứng trong cơ sở dữ liệu
                    const values = [
                        cols[0] || "",  // $1: so_tt (Số thứ tự)
                        cols[1] || "",  // $2: ho_va_ten (Họ và tên)
                        cols[2] || "",  // $3: nam_sinh (Năm sinh)
                        cols[3] || "",  // $4: que_quan (Quê quán)
                        cols[4] || "",  // $5: nam_hy_sinh (Năm hy sinh)
                        cols[5] || "",  // $6: don_vi (Đơn vị)
                        cols[9] || "",  // $7: danh_hieu (Danh hiệu)
                        cols[10] || "", // $8: board (Bảng hiển thị)
                        cols[6] || "",  // $9: "row" (Hàng)
                        cols[7] || "",  // $10: col (Cột)
                        cols[8] || ""   // $11: tieu_su (Tiểu sử)
                    ];
                    // Thực hiện lệnh chèn dữ liệu vào bảng danh_sach_trong_den
                    await client.query(`
                        INSERT INTO danh_sach_trong_den 
                        (so_tt, ho_va_ten, nam_sinh, que_quan, nam_hy_sinh, don_vi, danh_hieu, board, "row", col, tieu_su) 
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                    `, values);
                }
            }
            boardIndex++; // Tăng số đếm bảng lên 1
        }
        console.log("✅ Đã hoàn tất đồng bộ toàn bộ dữ liệu vào cơ sở dữ liệu!");
    } catch (err) {
        console.error("❌ Lỗi đồng bộ:", err.message); // Bắt lỗi và in ra thông báo nếu quá trình đồng bộ thất bại
    } finally {
        client.release(); // Trả lại kết nối client về pool sau khi hoàn tất hoặc xảy ra lỗi
    }
}

// THEO DÕI SỐ LƯỢNG NGƯỜI TRỰC TUYẾN
// Middleware tự động ghi nhận IP của bất kỳ ai gửi request đến server
app.use((req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress; // Lấy địa chỉ IP của client từ request header hoặc socket
    onlineUsers.add(ip); // Thêm IP vào danh sách online
    setTimeout(() => {
        onlineUsers.delete(ip);
    }, 15000); // Tự động xóa khỏi danh sách sau 15 giây không có request mới
    next(); // Chuyển sang middleware hoặc route tiếp theo
});

// Định nghĩa API trả về số lượng người đang online hiện tại
app.get('/api/online-count', (req, res) => {
    res.json({ online: onlineUsers.size > 0 ? onlineUsers.size : 1 }); // Trả về số lượng IP đang online (tối thiểu là 1 nếu chính mình đang truy cập)
});

// 3. API TRA CỨU: MỘ PHẦN (ĐÃ NÂNG CẤP LỌC KHÔNG DẤU & TÌM THIẾU CHỮ)
app.get('/api/martyrs', async (req, res) => {
    try {
        const { name, birth, home, area, row, grave } = req.query; // Lấy các tham số bộ lọc từ query string của URL
        let sql = `SELECT id_db AS id, so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo FROM danh_sach_liet_si WHERE 1=1`; // Câu lệnh SQL gốc lấy danh sách mộ phần
        const values = []; // Mảng chứa giá trị truyền vào câu lệnh SQL an toàn chống SQL Injection
        let paramIndex = 1; // Chỉ số đếm vị trí tham số trong câu lệnh SQL ($1, $2,...)
        
        // Kiểm tra và nối thêm điều kiện tìm theo tên (hỗ trợ không dấu, tìm thiếu chữ)
        if (name && name.trim()) { 
            sql += ` AND ${unaccentSQL('ho_va_ten')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; 
            values.push(formatSearchPattern(name)); 
            paramIndex++; 
        }
        // Kiểm tra và nối thêm điều kiện tìm theo năm sinh
        if (birth && birth.trim()) { 
            sql += ` AND nam_sinh ILIKE $${paramIndex}`; 
            values.push(`%${birth.trim()}%`); 
            paramIndex++; 
        }
        // Kiểm tra và nối thêm điều kiện tìm theo quê quán (hỗ trợ không dấu)
        if (home && home.trim()) { 
            sql += ` AND ${unaccentSQL('que_quan')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; 
            values.push(formatSearchPattern(home)); 
            paramIndex++; 
        }
        // Kiểm tra và nối thêm điều kiện tìm theo khu vực/hàng
        if (area && area.trim()) { 
            sql += ` AND ${unaccentSQL('hang')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; 
            values.push(formatSearchPattern(area)); 
            paramIndex++; 
        }
        // Kiểm tra và nối thêm điều kiện tìm theo hàng mộ
        if (row && row.trim()) { 
            sql += ` AND ${unaccentSQL('hang')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; 
            values.push(formatSearchPattern(row)); 
            paramIndex++; 
        }
        // Kiểm tra và nối thêm điều kiện tìm theo số mộ
        if (grave && grave.trim()) { 
            sql += ` AND so_mo ILIKE $${paramIndex}`; 
            values.push(`%${grave.trim()}%`); 
            paramIndex++; 
        }
        
        // Sắp xếp kết quả theo số thứ tự (chuyển sang kiểu số nguyên để sắp xếp đúng thứ tự)
        sql += " ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST";
        const result = await pool.query(sql, values); // Thực thi truy vấn với cơ sở dữ liệu
        res.json(result.rows); // Trả kết quả danh sách dưới dạng JSON cho client
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Mộ phần" }); // Báo lỗi 500 nếu gặp sự cố truy vấn
    }
});

// 4. API TRA CỨU: TRONG ĐỀN THỜ (ĐÃ NÂNG CẤP LỌC KHÔNG DẤU & TÌM THIẾU CHỮ)
app.get('/api/shrine-martyrs', async (req, res) => {
    try {
        const { name, birth, home, deathYear } = req.query; // Lấy bộ lọc tìm kiếm cho đền thờ
        // Câu lệnh SQL truy vấn danh sách liệt sĩ trong đền thờ
        let sql = `
            SELECT id_db AS id, ho_va_ten AS name, nam_sinh AS birth, que_quan AS home, 
                   nam_hy_sinh AS "deathYear", board, "row", col 
            FROM danh_sach_trong_den WHERE 1=1
        `;
        const values = []; // Mảng tham số bảo mật
        let paramIndex = 1; // Chỉ số đếm tham số
        
        // Lọc theo tên liệt sĩ trong đền thờ
        if (name && name.trim()) { 
            sql += ` AND ${unaccentSQL('ho_va_ten')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; 
            values.push(formatSearchPattern(name)); 
            paramIndex++; 
        }
        // Lọc theo năm sinh trong đền thờ
        if (birth && birth.trim()) { 
            sql += ` AND nam_sinh ILIKE $${paramIndex}`; 
            values.push(`%${birth.trim()}%`); 
            paramIndex++; 
        }
        // Lọc theo quê quán trong đền thờ
        if (home && home.trim()) { 
            sql += ` AND ${unaccentSQL('que_quan')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; 
            values.push(formatSearchPattern(home)); 
            paramIndex++; 
        }
        // Lọc theo năm hy sinh trong đền thờ
        if (deathYear && deathYear.trim()) { 
            sql += ` AND nam_hy_sinh ILIKE $${paramIndex}`; 
            values.push(`%${deathYear.trim()}%`); 
            paramIndex++; 
        }
        
        // Sắp xếp theo số thứ tự
        sql += " ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST";
        const result = await pool.query(sql, values); // Thực thi truy vấn
        res.json(result.rows); // Trả kết quả JSON về cho client
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Đền Thờ" }); // Báo lỗi nếu xảy ra vấn đề
    }
});

// 5. API CHI TIẾT: MỘ PHẦN (GIỮ NGUYÊN HOẠT ĐỘNG TỐT)
app.get('/api/martyrs/:id', async (req, res) => {
    try {
        // Truy vấn lấy toàn bộ thông tin chi tiết của một liệt sĩ theo ID mộ phần
        const result = await pool.query(`SELECT * FROM danh_sach_liet_si WHERE id_db = $1`, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy" }); // Báo lỗi 404 nếu không tìm thấy bản ghi
        res.json(result.rows[0]); // Trả về thông tin chi tiết của bản ghi đầu tiên tìm được
    } catch (err) { res.status(500).json({ error: "Lỗi chi tiết mộ phần" }); }
});

// 6. API CHI TIẾT: ĐỀN THỜ (GIỮ NGUYÊN HOẠT ĐỘNG TỐT)
app.get('/api/shrine-martyrs/:id', async (req, res) => {
    try {
        // Truy vấn lấy thông tin chi tiết một liệt sĩ trong đền thờ kèm theo bí danh cột tương ứng
        const result = await pool.query(`
            SELECT id_db AS id, ho_va_ten AS name, nam_sinh AS birth, que_quan AS home, 
                   nam_hy_sinh AS "deathYear", don_vi AS unit, danh_hieu AS "title", 
                   board, "row", col, tieu_su AS bio 
            FROM danh_sach_trong_den WHERE id_db = $1
        `, [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ message: "Không tìm thấy" }); // Báo lỗi nếu không có dữ liệu
        res.json(result.rows[0]); // Trả về kết quả dưới dạng JSON
    } catch (err) { res.status(500).json({ error: "Lỗi chi tiết đền thờ" }); }
});

// API LÀM MỚI DỮ LIỆU THỦ CÔNG
app.get('/api/sync-data', async (req, res) => {
    await dongBoToanBoDuLieu(); // Kích hoạt chạy lại hàm đồng bộ dữ liệu từ Google Sheets
    res.json({ message: "Đã cập nhật dữ liệu mới nhất từ Google Sheets!" }); // Phản hồi thông báo thành công
});

// WEBHOOK TỰ ĐỘNG NHẬN TÍN HIỆU ĐỒNG BỘ
app.post('/api/sync-webhook', async (req, res) => {
    try {
        console.log("🔄 Bắt đầu nhận tín hiệu đồng bộ qua Webhook...");
        await dongBoToanBoDuLieu(); // Chạy đồng bộ dữ liệu khi nhận tín hiệu từ bên ngoài (ví dụ: Google Apps Script gọi sang)
        console.log("✅ Webhook đã chạy xong lệnh đồng bộ!");
        res.status(200).json({ message: "Đồng bộ thành công!" }); // Phản hồi trạng thái thành công
    } catch (err) {
        console.error("❌ Lỗi khi Webhook kích hoạt đồng bộ:", err);
        res.status(500).json({ error: "Lỗi hệ thống khi đồng bộ" }); // Báo lỗi nếu thất bại
    }
});

// 7. KHỞI ĐỘNG SERVER
app.listen(port, async () => { 
    console.log(`🚀 Server đang chạy mượt mà tại cổng ${port}`); // In thông báo khi server khởi động thành công
    await dongBoToanBoDuLieu(); // Tự động chạy đồng bộ dữ liệu ngay khi vừa khởi động server xong
});
