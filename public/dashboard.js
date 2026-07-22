// Bi ăn cức, Trí chơi gay
// dashboard.js - Kết nối trực tiếp đến trạm dữ liệu Backend SQL
let currentPage = 1;
const rowsPerPage = 20; // Đã giảm xuống 20 hàng/trang

window.onload = function() {
    searchData(); // Tự động lấy dữ liệu từ SQL khi vừa mở trang web

    // Đăng ký sự kiện nhấn phím Enter trên các ô tìm kiếm để kích hoạt bộ lọc nhanh
    const searchInputs = document.querySelectorAll('.search-grid input');
    searchInputs.forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                currentPage = 1; // Đưa về trang đầu khi thực hiện lệnh tìm kiếm mới
                searchData();
            }
        });
    });
};

// Hàm gửi yêu cầu lấy dữ liệu đã qua bộ lọc từ Server Node.js
async function searchData() {
    // Thu thập giá trị từ 6 ô nhập liệu giao diện
    const queryParams = new URLSearchParams({
        name: document.getElementById("s_name").value,
        birth: document.getElementById("s_birthDate").value,
        home: document.getElementById("s_home").value,
        area: document.getElementById("s_area").value,
        row: document.getElementById("s_row").value,
        grave: document.getElementById("s_grave").value
    });

    try {
        const response = await fetch(`/api/martyrs?${queryParams.toString()}`);
        if (!response.ok) throw new Error('Mạng kết nối Backend có lỗi');
        
        const filteredData = await response.json();
        renderTableData(filteredData);
    } catch (error) {
        console.error("Lỗi fetch:", error);
        alert("Không thể kết nối đến trạm dữ liệu Backend!");
    }
}

// Vẽ dữ liệu danh sách nhận về lên bảng HTML
function renderTableData(filteredData) {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    // Phân trang dữ liệu hiển thị
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // Xử lý trường hợp không có kết quả tìm kiếm
    if (pageData.length === 0) {
        // Đã đổi colspan="7" vì bảng hiện tại có 7 cột (tính cả cột STT)
        tableBody.innerHTML = `<tr><td colspan="7" style="color: red; font-weight: bold; padding: 20px;">Không tìm thấy thông tin phù hợp!</td></tr>`;
        renderPagination(0);
        return;
    }

    pageData.forEach((item, index) => {
        // Thuật toán tính Số Thứ Tự (STT) dựa trên trang hiện tại
        let stt = startIndex + index + 1;

        // Cập nhật lại HTML sao cho hiển thị đúng 7 cột đã thiết kế
        // Lưu ý: Đã đổi item.so_tt thành item.khu_lo cho đúng với logic giao diện
        let row = `<tr>
            <td>${stt}</td>
            <td><a href="detail.html?id=${item.id}" class="martyr-link">${item.ho_va_ten || ''}</a></td>
            <td>${item.nam_sinh || ''}</td>
            <td>${item.que_quan || ''}</td>
            <td>${item.khu_lo || item.khu || ''}</td> 
            <td>${item.hang || ''}</td>
            <td>${item.so_mo || ''}</td>
        </tr>`;
        tableBody.innerHTML += row;
    });

    renderPagination(filteredData.length);
}

// Tạo các nút chuyển trang động
function renderPagination(totalRows) {
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    for (let i = 1; i <= pageCount; i++) {
        let btn = document.createElement("button");
        btn.innerText = i;
        if (i === currentPage) btn.className = "active";
        btn.onclick = () => { 
            currentPage = i; 
            searchData(); 
        };
        pagination.appendChild(btn);
    }
}
function updateRealtimeClock() {
    const now = new Date();

    // 1. Mảng tên các thứ trong tuần
    const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    const dayName = days[now.getDay()];

    // 2. Định dạng Ngày / Tháng / Năm (Thêm số 0 vào trước nếu nhỏ hơn 10)
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    // 3. Định dạng Giờ : Phút
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // 4. Ghép thành chuỗi dạng: "Thứ tư, 22/07/2026, 23:25"
    const timeString = `${dayName}, ${day}/${month}/${year}, ${hours}:${minutes}`;

    // 5. Gán vào HTML
    const clockElement = document.getElementById("current-datetime");
    if (clockElement) {
        clockElement.innerText = timeString;
    }
}

// Chạy hàm ngay khi trang web load xong
document.addEventListener("DOMContentLoaded", () => {
    updateRealtimeClock();
    // Tự động chạy lại mỗi 1 giây (1000ms) để đồng hồ luôn chính xác
    setInterval(updateRealtimeClock, 1000);
});
// Xóa trắng toàn bộ các ô nhập dữ liệu lọc thông tin
function clearSearch() {
    document.getElementById("s_name").value = "";
    document.getElementById("s_birthDate").value = "";
    document.getElementById("s_home").value = "";
    document.getElementById("s_area").value = "";
    document.getElementById("s_row").value = "";
    document.getElementById("s_grave").value = "";
    
    currentPage = 1;
    searchData();
}

// Hàm Đóng/Mở Menu trên điện thoại
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    nav.classList.toggle("show");
}
