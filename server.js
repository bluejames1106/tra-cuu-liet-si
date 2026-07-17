const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000; // Tự động nhận Port của Render hoặc dùng 3000 ở máy local

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // Giúp Render chạy được giao diện Frontend[cite: 1]

// CẤU HÌNH THÔNG TIN KẾT NỐI POSTGRESQL (Tự động nhận key DATABASE_URL từ Render)[cite: 1]
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://triadmin:rFlXAFe6ykl7pZCQC8ctYSiUgtrw2HEC@dpg-d9d5k0qhil2s73bcok10-a/postgresql_ywkd',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// HÀM BỔ TRỢ: Tách dòng CSV chuẩn xác tuyệt đối, giữ nguyên dấu phẩy nếu nằm trong ô text ""
function parseCSVRow(rowText) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < rowText.length; i++) {
    const char = rowText[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  return result;
}

// HÀM TỰ ĐỘNG ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEET (Giữ nguyên cấu trúc 10 cột chuẩn)[cite: 1]
async function dongBoDuLieuTuGoogleSheet() {
  const client = await pool.connect();
  try {
    // Tạo lại bảng với đúng 10 trường thông tin[cite: 1]
    await client.query('DROP TABLE IF EXISTS danh_sach_liet_si CASCADE;');
    await client.query(`
      CREATE TABLE danh_sach_liet_si (
        so_tt TEXT, ho_va_ten TEXT, nam_sinh TEXT, que_quan TEXT, 
        hang TEXT, so_mo TEXT, don_vi TEXT, ngay_hy_sinh TEXT, 
        noi_hy_sinh TEXT, tieu_su TEXT
      );
    `);
    
    // Tải CSV dữ liệu từ Google Sheets về[cite: 1]
    const response = await fetch('https://docs.google.com/spreadsheets/d/1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U/export?format=csv&gid=0');
    const csvText = await response.text();
    
    const rows = csvText.split(/\r?\n/).slice(1); // Bỏ dòng tiêu đề[cite: 1]
    
    for (let row of rows) {
      if (!row || row.trim() === '') continue;
      
      const cols = parseCSVRow(row);
      // Đảm bảo mapping chuẩn xác theo đúng thứ tự 10 cột vào CSDL[cite: 1]
      const values = Array.from({ length: 10 }, (_, i) => cols[i] || "");
      
      await client.query(`
        INSERT INTO danh_sach_liet_si 
        (so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, values);
    }
    console.log("🔄 Đồng bộ dữ liệu từ Google Sheets vào Postgres thành công!");
  } catch (err) {
    console.error("❌ Lỗi đồng bộ Google Sheets:", err.message);
  } finally {
    client.release();
  }
}

// 1. API: LẤY DANH SÁCH LIỆT SĨ (Giữ nguyên y hệt logic lọc và thứ tự SQL cũ của bạn)[cite: 1]
app.get('/api/martyrs', async (req, res) => {
  try {
    // Tự động cập nhật dữ liệu mới nhất từ Google Sheets trước khi tìm kiếm[cite: 1]
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

    if (name) {
      sql += ` AND ho_va_ten ILIKE $${paramIndex}`;
      values.push(`%${name}%`);
      paramIndex++;
    }
    if (birth) {
      sql += ` AND nam_sinh ILIKE $${paramIndex}`;
      values.push(`%${birth}%`);
      paramIndex++;
    }
    if (home) {
      sql += ` AND que_quan ILIKE $${paramIndex}`;
      values.push(`%${home}%`);
      paramIndex++;
    }
    if (area) {
      sql += ` AND hang ILIKE $${paramIndex}`;
      values.push(`%${area}%`);
      paramIndex++;
    }
    if (row) {
      sql += ` AND so_mo ILIKE $${paramIndex}`;
      values.push(`%${row}%`);
      paramIndex++;
    }
    if (grave) {
      sql += ` AND so_tt ILIKE $${paramIndex}`;
      values.push(`%${grave}%`);
      paramIndex++;
    }

    // Giữ nguyên kiểu sắp xếp cũ theo yêu cầu[cite: 1]
    sql += " ORDER BY CAST(so_tt AS INT) ASC";

    const result = await pool.query(sql, values);
    res.json(result.rows); 
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Lỗi Server khi tải danh sách");
  }
});

// 2. API: LẤY CHI TIẾT THEO ID (Giữ nguyên cấu trúc SELECT cũ của bạn)[cite: 1]
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

// KHỞI ĐỘNG SERVER
app.listen(port, () => {
  console.log(`Server đang chạy mượt mà tại cổng ${port}`);
});
