const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 3000;
const path = require('path'); // Thêm dòng này
app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); // Sửa thành dòng này

// CẤU HÌNH KẾT NỐI POSTGRESQL CỦA BẠN
const pool = new Pool({
  user: 'postgres',              
  host: 'localhost',              
  database: 'postgres',          
  password: '1',  // Thay bằng mật khẩu thực tế của bạn
  port: 5432,                    
});

// HÀM TỰ ĐỘNG ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEET VÀO SQL (Thay thế nút Play của pgAdmin)
async function dongBoDuLieuTuGoogleSheet() {
  const client = await pool.connect();
  try {
    // Chạy chuỗi lệnh y hệt như bạn đã chạy trong pgAdmin
    await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;');
    
    await client.query(`
      CREATE TABLE danh_sach_liet_si (
        so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
        hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, 
        noi_hy_sinh TEXT, tieu_su TEXT
      );
    `);
    
    // Lệnh curl thần thánh để hút dữ liệu từ link Google Sheets của bạn về
    await client.query(`
      COPY danh_sach_liet_si 
      FROM PROGRAM 'curl -sL "https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0"' 
      WITH (FORMAT CSV, HEADER true, DELIMITER ',');
    `);
    
    console.log("🔄 Đã tự động cập nhật dữ liệu mới nhất từ Google Sheets vào SQL thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi tự động đồng bộ dữ liệu:", err.message);
  } finally {
    client.release(); // Giải phóng kết nối
  }
}

// 1. API: LẤY DANH SÁCH LIỆT SĨ (Mỗi lần gọi API này sẽ tự động đồng bộ dữ liệu trước)
app.get('/api/martyrs', async (req, res) => {
  try {
    // Gọi hàm đồng bộ dữ liệu từ Google Sheets trước khi quét dữ liệu trả về cho web
    await dongBoDuLieuTuGoogleSheet();

    const { name, birth, home, area, row, grave } = req.query;

    let sql = `
      SELECT 
        so_tt AS id, 
        so_tt, 
        ho_va_ten, 
        nam_sinh, 
        que_quan, 
        hang, 
        so_mo 
      FROM danh_sach_liet_si 
      WHERE 1=1
    `;
    const values = [];
    let paramIndex = 1;

    if (name) { sql += ` AND ho_va_ten ILIKE $${paramIndex}`; values.push(`%${name}%`); paramIndex++; }
    if (birth) { sql += ` AND nam_sinh ILIKE $${paramIndex}`; values.push(`%${birth}%`); paramIndex++; }
    if (home) { sql += ` AND que_quan ILIKE $${paramIndex}`; values.push(`%${home}%`); paramIndex++; }
    if (area) { sql += ` AND hang ILIKE $${paramIndex}`; values.push(`%${area}%`); paramIndex++; }
    if (row) { sql += ` AND so_mo ILIKE $${paramIndex}`; values.push(`%${row}%`); paramIndex++; }
    if (grave) { sql += ` AND so_tt ILIKE $${paramIndex}`; values.push(`%${grave}%`); paramIndex++; }

    sql += " ORDER BY CAST(so_tt AS INT) ASC";

    const result = await pool.query(sql, values);
    res.json(result.rows); 
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server khi tải danh sách");
  }
});

// 2. API: LẤY CHI TIẾT THEO ID
app.get('/api/martyrs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const sql = `
      SELECT 
        so_tt AS id, 
        so_tt, 
        ho_va_ten, 
        nam_sinh, 
        que_quan, 
        hang, 
        so_mo, 
        don_vi, 
        ngay_hy_sinh, 
        noi_hy_sinh, 
        tieu_su
      FROM danh_sach_liet_si 
      WHERE so_tt = $1
    `;
    
    const result = await pool.query(sql, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Không tìm thấy liệt sĩ" });
    }

    res.json(result.rows[0]); 
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server khi tải chi tiết");
  }
});

const fs = require('fs'); // Thêm dòng này ở đầu file nếu chưa có

app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`Server đang chạy tại cổng ${port}`);
  
  // Đoạn code tự kiểm tra thư mục public
  const publicPath = path.join(__dirname, 'public');
  console.log(`Đường dẫn thư mục public: ${publicPath}`);
  
  if (fs.existsSync(publicPath)) {
    console.log(`✅ Thư mục 'public' TỒN TẠI!`);
    console.log(`Danh sách các file bên trong:`, fs.readdirSync(publicPath));
  } else {
    console.log(`❌ LỖI: Không tìm thấy thư mục 'public' ở đường dẫn trên!`);
  }
  console.log(`=========================================`);
});