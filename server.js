const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 

const app = express();
const port = process.env.PORT || 3000; // Render sẽ tự động gán Port, nếu chạy ở máy tính thì dùng 3000

app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); 

// CẤU HÌNH KẾT NỐI POSTGRESQL (Tự động nhận cấu hình từ Render qua biến DATABASE_URL)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1@localhost:5432/postgres',
  // Khi chạy trên Render thường cần bật SSL cho kết nối database
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// HÀM ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEET VÀO SQL BẰNG NODE.JS
async function dongBoDuLieuTuGoogleSheet() {
  const client = await pool.connect();
  try {
    // 1. Xóa và tạo lại bảng
    await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;');
    await client.query(`
      CREATE TABLE danh_sach_liet_si (
        so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
        hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, 
        noi_hy_sinh TEXT, tieu_su TEXT
      );
    `);
    
    // 2. Dùng Fetch của Node.js để tải file CSV từ Google Sheets (Thay thế lệnh curl bị cấm)
    const response = await fetch('https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0');
    const csvText = await response.text();
    
    // 3. Tách dữ liệu thành từng dòng (bỏ qua dòng tiêu đề đầu tiên)
    const rows = csvText.split('\n').slice(1);
    
    // 4. Lặp từng dòng và lưu vào CSDL
    for (let row of rows) {
      if (!row || row.trim() === '') continue; // Bỏ qua dòng trống
      
      // Xử lý tách cột (Giả sử các cột phân tách bằng dấu phẩy)
      const cols = row.split(',').map(col => col.trim().replace(/^"|"$/g, ''));
      const values = Array.from({ length: 10 }, (_, i) => cols[i] || "");
      
      await client.query(`
        INSERT INTO danh_sach_liet_si 
        (so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, values);
    }
    
    console.log("🔄 Đã tải dữ liệu từ Google Sheets qua Node.js và cập nhật DB thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi Node.js đồng bộ dữ liệu:", err.message);
  } finally {
    client.release(); // Giải phóng kết nối
  }
}

// 1. API: LẤY DANH SÁCH LIỆT SĨ
app.get('/api/martyrs', async (req, res) => {
  try {
    // Tự động đồng bộ dữ liệu trước khi quét
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

    // Sửa lại đoạn order by một chút để tránh lỗi với các giá trị không phải số (nếu có)
    sql += " ORDER BY so_tt ASC";

    const result = await pool.query(sql, values);
    res.json(result.rows); 
  } catch (err) {
    console.error("Lỗi API martyrs:", err.message);
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
    console.error("Lỗi API chi tiết:", err.message);
    res.status(500).send("Lỗi Server khi tải chi tiết");
  }
});

// KHỞI ĐỘNG SERVER
app.listen(port, () => {
  console.log(`=========================================`);
  console.log(`Server đang chạy tại cổng ${port}`);
  
  const publicPath = path.join(__dirname, 'public');
  if (fs.existsSync(publicPath)) {
    console.log(`✅ Thư mục 'public' TỒN TẠI!`);
  } else {
    console.log(`❌ LỖI: Không tìm thấy thư mục 'public'!`);
  }
  console.log(`=========================================`);
});
