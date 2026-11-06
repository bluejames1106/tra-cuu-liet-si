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
let searchCache = new Map(); // Lưu tạm kết quả tìm kiếm vào RAM để khi nhiều người tìm cùng 1 từ khóa sẽ trả về ngay mà không cần query lại DB
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

// --- 2. ĐỒNG BỘ DỮ LIỆU TỪ GOOGLE SHEETS ---
const graveFields = [
    'so_tt', 'ho_va_ten', 'nam_sinh', 'que_quan', 'hang', 'so_mo',
    'don_vi', 'ngay_hy_sinh', 'noi_hy_sinh', 'tieu_su',
];
const shrineFields = [
    'so_tt', 'ho_va_ten', 'nam_sinh', 'que_quan', 'nam_hy_sinh',
    'don_vi', 'row', 'col', 'tieu_su', 'danh_hieu', 'board',
];
const graveIdentity = ['ho_va_ten', 'nam_sinh', 'que_quan', 'don_vi', 'ngay_hy_sinh', 'noi_hy_sinh'];
const shrineIdentity = ['ho_va_ten', 'nam_sinh', 'que_quan', 'don_vi', 'nam_hy_sinh'];
const shrineGids = ['0','1535376381','229682585','520701169','2030583334','1552740471','1389251803','1632293714','1118900454','562787330','931770250','63868212','2130958121','256922227','2097412071','1054116265','1299177025','1439180598','413166391','1756903717','164496961','2077216878','1022296475','1621758412','1552883430','304395981','1114052683','63106793','673908648','1869183334','52622078','763440068','598118087','65569213','954278689','1006110729','1948432892','434483961','989976984','1252658950','1937625546','513652196','1896480892','1853329247','436425650','665842120'];

function normalizeField(value) {
    return (value ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseCSV(text) {
    const rows = [];
    let row = [];
    // Đọc từng ô để giữ dấu phẩy, dấu ngoặc kép và xuống dòng trong ô CSV.
    const cell = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\r|\n|$)/gy;
    while (cell.lastIndex < text.length) {
        const match = cell.exec(text);
        if (!match) throw new Error('CSV có ô không đúng định dạng.');
        row.push(match[1] === undefined ? match[2].trim() : match[1].replace(/""/g, '"').trim());
        if (match[3] !== ',') {
            rows.push(row);
            row = [];
        }
    }
    if (row.length) rows.push([...row, '']);
    return rows;
}

async function readSheet(sheetId, gid, fields) {
    const response = await fetch(
        'https://docs.google.com/spreadsheets/d/' + sheetId + '/export?format=csv&gid=' + gid,
        { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok) throw new Error('Không tải được tab ' + gid + ' (HTTP ' + response.status + ').');

    const text = (await response.text()).replace(/^\uFEFF/, '');
    const [header, ...rows] = parseCSV(text);
    const nameHeader = normalizeField(header?.[1]).normalize('NFD').replace(/\p{M}/gu, '');
    if (/^\s*</.test(text) || !/\bten\b/.test(nameHeader)) {
        throw new Error('Tab ' + gid + ' không có tiêu đề CSV tra cứu hợp lệ.');
    }

    return rows.filter(row => row[1]).map(row => {
        const order = row[0];
        if (row.length > header.length ||
            (order && (!/^[+-]?\d+$/.test(order) || Number(order) < -2147483648 || Number(order) > 2147483647))) {
            throw new Error('Tab ' + gid + ' có dòng dữ liệu không hợp lệ.');
        }
        return Object.fromEntries(fields.map((field, index) => [field, row[index] ?? '']));
    });
}

function groupRecords(rows, fields) {
    const groups = new Map();
    for (const row of rows) {
        const key = JSON.stringify(fields.map(field => normalizeField(row[field])));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
    }
    return groups;
}

function assignExistingIds(current, incoming, identityFields, fields) {
    const existingGroups = groupRecords(current, identityFields);
    const incomingGroups = groupRecords(incoming, identityFields);
    // Số thứ tự có thể đổi khi sắp xếp lại Sheet.
    const exactFields = fields.filter(field => field !== 'so_tt');
    for (const [key, rows] of incomingGroups) {
        const existing = existingGroups.get(key) ?? [];
        if (rows.length === 1 && existing.length <= 1) {
            if (existing.length) rows[0].id_db = existing[0].id_db;
            continue;
        }

        // Trùng thông tin nhận dạng: chỉ giữ ID nếu toàn bộ chi tiết còn lại khớp duy nhất.
        const exactExisting = groupRecords(existing, exactFields);
        for (const [exactKey, exactRows] of groupRecords(rows, exactFields)) {
            const matches = exactExisting.get(exactKey) ?? [];
            if (exactRows.length !== 1 || (existing.length && matches.length !== 1)) {
                throw new Error('Có hồ sơ trùng thông tin, không thể giữ ID một cách an toàn.');
            }
            if (matches.length) exactRows[0].id_db = matches[0].id_db;
        }
    }
}

async function ensureTable(client, table, fields) {
    await client.query(
        'CREATE TABLE IF NOT EXISTS ' + table + ' (id_db SERIAL PRIMARY KEY, ' +
        fields.map(field => '"' + field + '" TEXT').join(', ') + ', is_active BOOLEAN NOT NULL DEFAULT TRUE)',
    );
    await client.query(
        'ALTER TABLE ' + table + ' ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE',
    );
}

async function prepareTables() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(734251, 1)');
        await ensureTable(client, 'danh_sach_liet_si', graveFields);
        await ensureTable(client, 'danh_sach_trong_den', shrineFields);
        await client.query('COMMIT');
    } catch (error) {
        client.release(error);
        throw error;
    }
    client.release();
}

async function applySnapshot(client, table, fields, identityFields, rows) {
    // Tên bảng và cột chỉ lấy từ cấu hình nội bộ.
    const columns = fields.map(field => '"' + field + '"').join(', ');
    const current = await client.query('SELECT * FROM ' + table);
    assignExistingIds(current.rows, rows, identityFields, fields);
    const existingIds = rows.filter(row => row.id_db !== undefined).map(row => row.id_db);
    const snapshot = JSON.stringify(rows);

    // Hồ sơ vắng mặt trong lần nhập mới được ẩn khỏi tìm kiếm nhưng giữ ID cho link cũ.
    await client.query(
        'UPDATE ' + table + ' SET is_active = FALSE WHERE is_active AND NOT (id_db = ANY($1::int[]))',
        [existingIds],
    );
    const assignments = fields.map(field => '"' + field + '" = incoming."' + field + '"').join(', ');
    const incomingRecords = 'jsonb_populate_recordset(NULL::' + table + ', $1::jsonb)';
    await client.query(
        'UPDATE ' + table + ' AS stored SET ' + assignments + ', is_active = TRUE ' +
        'FROM ' + incomingRecords + ' AS incoming WHERE stored.id_db = incoming.id_db',
        [snapshot],
    );
    await client.query(
        'INSERT INTO ' + table + ' (' + columns + ') SELECT ' + columns +
        ' FROM ' + incomingRecords + ' AS incoming WHERE incoming.id_db IS NULL',
        [snapshot],
    );
}

async function dongBoToanBoDuLieu() {
    const client = await pool.connect();
    let rollbackError;
    try {
        await client.query('BEGIN');
        const lock = await client.query('SELECT pg_try_advisory_xact_lock(734251, 1) AS acquired');
        if (!lock.rows[0].acquired) {
            await client.query('ROLLBACK');
            return false;
        }

        const graveRows = await readSheet('1TbM4AzOCczRc_5nSlQY3iT5aOYXSAb2W5PTqjNJYx_U', '0', graveFields);
        const shrineRows = [];
        for (const gid of shrineGids) {
            const rows = await readSheet('18KqyTFMNp_1hm4hQObfc7b8HtmsLLD6jkievCvYkF4U', gid, shrineFields);
            for (const row of rows) shrineRows.push(row);
        }
        if (!graveRows.length || !shrineRows.length) {
            throw new Error('Danh sách mộ phần hoặc đền thờ trống.');
        }

        await applySnapshot(client, 'danh_sach_liet_si', graveFields, graveIdentity, graveRows);
        await applySnapshot(client, 'danh_sach_trong_den', shrineFields, shrineIdentity, shrineRows);
        await client.query('COMMIT');
        searchCache = new Map();
        return true;
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (err) {
            rollbackError = err;
        }
        throw error;
    } finally {
        client.release(rollbackError);
    }
}


// --- 3. API TRA CỨU: MỘ PHẦN (Có tích hợp Cache và tối ưu tìm kiếm) ---
app.get('/api/martyrs', async (req, res) => {
    try {
        const cache = searchCache;
        const cacheKey = JSON.stringify(req.query);
        if (cache.has(cacheKey)) {
            return res.json(cache.get(cacheKey)); // Nếu từ khóa này đã được tìm trước đó, lấy ngay kết quả từ RAM trả về
        }

        const { name, birth, home, area, row, grave } = req.query;
        let sql = `SELECT id_db AS id, so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo FROM danh_sach_liet_si WHERE is_active`;
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
        
        cache.set(cacheKey, result.rows); // Lưu kết quả vào bộ nhớ tạm
        setTimeout(() => cache.delete(cacheKey), 30000); // Sau 30 giây tự động xóa cache này đi để cập nhật mới nếu cần

        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Mộ phần" }); 
    }
});


// --- 4. API TRA CỨU: TRONG ĐỀN THỜ ---
app.get('/api/shrine-martyrs', async (req, res) => {
    try {
        const cache = searchCache;
        const cacheKey = 'shrine_' + JSON.stringify(req.query);
        if (cache.has(cacheKey)) {
            return res.json(cache.get(cacheKey));
        }

        const { name, birth, home, deathYear } = req.query;
        let sql = `
            SELECT id_db AS id, ho_va_ten AS name, nam_sinh AS birth, que_quan AS home, 
                   nam_hy_sinh AS "deathYear", board, "row", col 
            FROM danh_sach_trong_den WHERE is_active
        `;
        const values = []; 
        let paramIndex = 1;
        
        if (name && name.trim()) { sql += ` AND ${unaccentSQL('ho_va_ten')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(name)); paramIndex++; }
        if (birth && birth.trim()) { sql += ` AND nam_sinh ILIKE $${paramIndex}`; values.push(`%${birth.trim()}%`); paramIndex++; }
        if (home && home.trim()) { sql += ` AND ${unaccentSQL('que_quan')} LIKE ${unaccentSQL(`$${paramIndex}`)}`; values.push(formatSearchPattern(home)); paramIndex++; }
        if (deathYear && deathYear.trim()) { sql += ` AND nam_hy_sinh ILIKE $${paramIndex}`; values.push(`%${deathYear.trim()}%`); paramIndex++; }
        
        sql += " ORDER BY CAST(NULLIF(TRIM(so_tt), '') AS INT) ASC NULLS LAST";
        const result = await pool.query(sql, values);
        
        cache.set(cacheKey, result.rows);
        setTimeout(() => cache.delete(cacheKey), 30000);

        res.json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: "Lỗi Server API Đền Thờ" }); 
    }
});


// --- 5. API XEM CHI TIẾT 1 MỘ PHẦN ---
app.get('/api/martyrs/:id', async (req, res) => {
    try {
        const result = await pool.query(`SELECT id_db, so_tt, ho_va_ten, nam_sinh, que_quan, hang, so_mo, don_vi, ngay_hy_sinh, noi_hy_sinh, tieu_su FROM danh_sach_liet_si WHERE id_db = $1`, [req.params.id]);
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
function syncHandler(successMessage) {
    return async (req, res) => {
        try {
            const updated = await dongBoToanBoDuLieu();
            if (!updated) return res.status(409).json({ error: "Đang có một lần đồng bộ khác." });
            res.json({ message: successMessage });
        } catch (error) {
            console.error("Lỗi đồng bộ:", error.message);
            res.status(500).json({ error: "Đồng bộ thất bại. Dữ liệu tra cứu trước đó vẫn được giữ." });
        }
    };
}

app.get('/api/sync-data', syncHandler("Đã cập nhật dữ liệu mới nhất từ Google Sheets!"));
app.post('/api/sync-webhook', syncHandler("Đồng bộ thành công!"));

// --- 7. KHỞI ĐỘNG SERVER ---
prepareTables().then(() => {
    server.listen(port, () => {
        console.log(`🚀 Server đang chạy tại cổng ${port}`);
        dongBoToanBoDuLieu().catch(error => console.error("Lỗi đồng bộ khi khởi động:", error.message));
    });
}).catch(error => {
    console.error("Lỗi chuẩn bị bảng tra cứu:", error.message);
    process.exitCode = 1;
});
