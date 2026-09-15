/* ==========================================================================
   DASHBOARD.JS - Xử lý logic tìm kiếm, phân trang và kết nối Backend
   ========================================================================== */

let currentPage = 1;
const rowsPerPage = 20; // Số lượng hàng hiển thị trên mỗi trang

// Khởi tạo trang: tải dữ liệu ban đầu và gán sự kiện tìm kiếm
window.onload = function() {
    searchData();

    // Lắng nghe sự kiện phím Enter trên các ô nhập liệu để tìm kiếm nhanh
    const searchInputs = document.querySelectorAll('.search-grid input');
    searchInputs.forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                currentPage = 1; // Reset về trang đầu tiên khi có truy vấn mới
                searchData();
            }
        });
    });
};

// Gửi yêu cầu lấy dữ liệu từ Backend dựa trên bộ lọc
async function searchData() {
    // Thu thập tham số từ các ô nhập liệu giao diện
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
        console.error("Lỗi kết nối:", error);
        window.location.href = "error.html";
    }
}

// Hiển thị dữ liệu lên bảng HTML
function renderTableData(filteredData) {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    // Phân nhỏ dữ liệu hiển thị theo trang hiện tại
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const pageData = filteredData.slice(startIndex, endIndex);

    // Xử lý thông báo khi không có kết quả phù hợp
    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="color: red; font-weight: bold; padding: 20px;">Không tìm thấy thông tin phù hợp!</td></tr>`;
        renderPagination(0);
        return;
    }

    // Vẽ cấu trúc hàng dữ liệu
    pageData.forEach((item, index) => {
        // Tính toán số thứ tự liên tục giữa các trang
        let stt = startIndex + index + 1;

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

// Khởi tạo và hiển thị thanh phân trang
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

// Cập nhật đồng hồ thời gian thực
function updateRealtimeClock() {
    const now = new Date();

    const days = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];
    const dayName = days[now.getDay()];

    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();

    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    // Ghép thành chuỗi hiển thị
    const timeString = `${dayName}, ${day}/${month}/${year}, ${hours}:${minutes}`;

    const clockElement = document.getElementById("current-datetime");
    if (clockElement) {
        clockElement.innerText = timeString;
    }
}

// Kích hoạt đồng hồ khi tải trang và lặp lại mỗi giây
document.addEventListener("DOMContentLoaded", () => {
    updateRealtimeClock();
    setInterval(updateRealtimeClock, 1000);
});

// Xóa trắng biểu mẫu bộ lọc và tải lại bảng mặc định
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

// Đóng/mở menu điều hướng trên thiết bị di động
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    nav.classList.toggle("show");
}

// Chuyển hướng đến trang lỗi khi mất kết nối mạng
window.addEventListener('offline', function() {
    window.location.href = "error.html";
});
