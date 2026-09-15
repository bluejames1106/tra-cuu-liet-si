# 🕊️ Hệ Thống Tra Cứu Thông Tin Liệt Sĩ Phước An

Hệ thống tra cứu và quản lý hồ sơ liệt sĩ Phước An, hỗ trợ tìm kiếm liệt sĩ thờ tự trong đền thờ và ngoài mộ phần nghĩa trang.

---

## 🔗 Đường Dẫn Hệ Thống & Biểu Mẫu

* 🌐 **Trang web chính thức:** [Tra cứu Liệt sĩ Phước An](https://tinyurl.com/tra-cuu-liet-si-phuoc-an)
* 🏛️ **Nhập thông tin liệt sĩ trong đền thờ:** [Form Đền Thờ](https://tinyurl.com/lietsi-dentho)
* 🪦 **Nhập thông tin liệt sĩ ngoài mộ phần:** [Form Mộ Phần](https://tinyurl.com/lietsi-mophan)

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

* **Backend:** Node.js, Express.js
* **Database:** PostgreSQL (Hỗ trợ truy vấn SQL tìm kiếm không dấu / Accentless Search)
* **Frontend:** HTML5, CSS3, JavaScript (Vanilla JS / Fetch API)

---

## 📁 Cấu Trúc Dự Án (Project Structure)

```text
.
├── public/                     # Thư mục chứa tài nguyên tĩnh (Static Assets & Client Interface)
│   ├── index.html              # Trang đích chính (Landing page)
│   ├── trangchu.html           # Trang chủ tra cứu
│   ├── trangchu.css            # Style giao diện trang chủ
│   ├── trangchu.js             # Logic xử lý tìm kiếm và điều hướng trang chủ
│   │
│   ├── temple.html             # Danh sách & tra cứu liệt sĩ trong đền thờ
│   ├── temple.js               # Logic tra cứu danh sách liệt sĩ đền thờ
│   ├── temple_detail.html      # Trang chi tiết hồ sơ liệt sĩ trong đền thờ
│   ├── temple_detail.js        # Logic tải thông tin chi tiết liệt sĩ đền thờ
│   │
│   ├── detail.html             # Trang chi tiết hồ sơ liệt sĩ (mộ phần/chung)
│   ├── detail.js               # Logic lấy và hiển thị chi tiết hồ sơ liệt sĩ
│   │
│   ├── dashboard.css           # Style giao diện bảng điều khiển quản trị
│   ├── dashboard.js            # Logic xử lý bảng điều khiển & thống kê
│   ├── error.html              # Trang hiển thị thông báo lỗi hệ thống
│   │
│   └── [images]                # Các tệp hình ảnh đồ họa (nghiatrang.jpg, dentholietsi.jpg, hoasen.jpg,...)
│
├── server.js                   # Entry point backend: Cấu hình Express, API Routes & kết nối CSDL PostgreSQL
├── package.json                # Quản lý các gói phụ thuộc (Dependencies) & cấu hình Scripts
└── package-lock.json           # Khóa phiên bản phụ thuộc
