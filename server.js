const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); 

const app = express();
const port = process.env.PORT || 3000; 

app.use(cors());
app.use(express.static(path.join(__dirname, 'public'))); 

// CẤU HÌNH KẾT NỐI POSTGRESQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:1@localhost:5432/postgres',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// HÀM BỔ TRỢ: Tách dòng CSV chuẩn xác, bỏ qua các dấu phẩy nằm bên trong ô văn bản ""
function parseCSVRow(rowText) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      inQuotes = !inQuotes; // Đổi trạng thái khi gặp hoặc thoát khỏi dấu ngoặc kép
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"')); // Hết 1 ô dữ liệu
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"')); // Ô dữ liệu cuối cùng
  return result;
}

// HÀM TỰ ĐỘNG ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEET VÀO SQL
async function dongBoDuLieuTuGoogleSheet() {
  const client = await pool.connect();
  try {
    // 1. Khởi tạo lại cấu trúc bảng
    await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;');
    await client.query(`
      CREATE TABLE danh_sach_liet_si (
        so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
        hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, 
        noi_hy_sinh TEXT, tieu_su TEXT
      );
    `);
    
    // 2. Tải file CSV từ link Google Sheets công khai
    const response = await fetch('https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0');
    const csvText = await response.text();
    
    // 3. Tách dữ liệu thành từng dòng và bỏ dòng tiêu đề đầu tiên
    const rows = csvText.split(/\r?\n/).slice(1);
    
    // 4. Quét từng dòng dữ liệu bằng bộ lọc thông minh mới
    for (let row of rows) {
      if (!row || row.trim() === '') continue; 
      
      // Sử dụng hàm xử lý CSV chuẩn để không bị lệch cột khi gặp dấu phẩy trong văn bản
      const cols = parseCSVRow(row);
      
      // Đảm bảo luôn có đủ 10 cột dữ liệu để truyền vào DB
      const values = Array.from({ length: 10 }, (_, i) => cols[i] || "");
      
      await client.query(`
        INSERT INTO danh_sach_liet_si 
        (so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, values);
    }
    
    console.log("🔄 Đã xử lý CSV chuẩn và đồng bộ vào Database thành công!");
  } catch (err) {
    console.error("❌ Lỗi khi đồng bộ dữ liệu:", err.message);
  } finally {
    client.release(); 
  }
}

// 1. API: LẤY DANH SÁCH LIỆT SĨ
app.get('/api/martyrs', async (req, res) => {
  try {
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
  console.log(`=========================================`);
});
