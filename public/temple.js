/* ==========================================================================
   TEMPLE.JS - Xử lý logic tìm kiếm và hiển thị danh sách liệt sĩ trong Đền thờ
   ========================================================================== */

let currentPage = 1;
const rowsPerPage = 20;

// Khởi tạo trang: tải dữ liệu ban đầu và gán sự kiện tìm kiếm
window.onload = function() {
    renderTable();
    
    // Lắng nghe sự kiện phím Enter trên các ô nhập liệu để tìm kiếm nhanh
    const searchInputs = document.querySelectorAll('.search-grid input');
    searchInputs.forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                currentPage = 1;
                renderTable();
            }
        });
    });
};

// Gửi yêu cầu lấy dữ liệu và hiển thị lên bảng
async function renderTable() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" style="padding: 20px;">Đang tải dữ liệu từ cơ sở dữ liệu...</td></tr>`;

    // Thu thập tham số từ các ô nhập liệu
    const sName = document.getElementById("t_name").value.trim();
    const sBirth = document.getElementById("t_birth").value.trim();
    const sHome = document.getElementById("t_home").value.trim();
    const sDeath = document.getElementById("t_deathYear").value.trim();

    try {
        const queryParams = new URLSearchParams({
            name: sName,
            birth: sBirth,
            home: sHome,
            deathYear: sDeath
        });
        
        const response = await fetch(`/api/shrine-martyrs?${queryParams.toString()}`);
        if (!response.ok) throw new Error("Lỗi tải dữ liệu");
        
        const filteredData = await response.json();

        tableBody.innerHTML = "";

        // Xử lý thông báo khi không có kết quả phù hợp
        if (filteredData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="color: red; font-weight: bold; padding: 20px;">Không tìm thấy thông tin phù hợp!</td></tr>`;
            renderPagination(0);
            return;
        }

        // Phân nhỏ dữ liệu hiển thị theo trang hiện tại
        const startIndex = (currentPage - 1) * rowsPerPage;
        const pageData = filteredData.slice(startIndex, startIndex + rowsPerPage);

        // Vẽ cấu trúc hàng dữ liệu
        pageData.forEach((item, index) => {
            let stt = startIndex + index + 1;
            
            let row = `<tr>
                <td>${stt}</td>
                <td><a href="temple_detail.html?id=${item.id}" class="martyr-link">${item.name}</a></td>
                <td>${item.birth || ""}</td>
                <td>${item.home || ""}</td>
                <td>${item.deathYear || ""}</td>
                <td>${item.board || ""}</td>
                <td>${item.row || ""}</td>
                <td>${item.col || ""}</td>
            </tr>`;
            tableBody.innerHTML += row;
        });

        renderPagination(filteredData.length);
    } catch (error) {
        console.error("Lỗi kết nối:", error);
        tableBody.innerHTML = `<tr><td colspan="8" style="color: red; padding: 20px;">Không thể kết nối với máy chủ SQL!</td></tr>`;
        window.location.href = "error.html";
    }
}

// Khởi tạo và hiển thị thanh phân trang dạng thu gọn
function renderPagination(totalRows) {
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    // Ẩn thanh phân trang nếu chỉ có 1 trang
    if (pageCount <= 1) return; 

    // Nút điều hướng "Trang trước"
    if (currentPage > 1) {
        let prevBtn = document.createElement("button");
        prevBtn.innerText = "«";
        prevBtn.onclick = () => { 
            currentPage--; 
            renderTable(); 
            scrollToTable();
        };
        pagination.appendChild(prevBtn);
    }

    // Thuật toán tính toán các số trang hiển thị
    let pages = [];
    const delta = 1; 

    for (let i = 1; i <= pageCount; i++) {
        if (i === 1 || i === pageCount || (i >= currentPage - delta && i <= currentPage + delta)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    // Vẽ các nút số trang
    pages.forEach(page => {
        if (page === '...') {
            let span = document.createElement("span");
            span.innerText = "...";
            span.style.padding = "0 6px";
            span.style.alignSelf = "center";
            span.style.color = "#888";
            pagination.appendChild(span);
        } else {
            let btn = document.createElement("button");
            btn.innerText = page;
            if (page === currentPage) btn.className = "active";
            btn.onclick = () => { 
                currentPage = page; 
                renderTable(); 
                scrollToTable();
            };
            pagination.appendChild(btn);
        }
    });

    // Nút điều hướng "Trang sau"
    if (currentPage < pageCount) {
        let nextBtn = document.createElement("button");
        nextBtn.innerText = "»";
        nextBtn.onclick = () => { 
            currentPage++; 
            renderTable(); 
            scrollToTable();
        };
        pagination.appendChild(nextBtn);
    }
}

// Tự động cuộn màn hình lên đầu bảng khi chuyển trang
function scrollToTable() {
    const tableHeader = document.querySelector("table") || document.getElementById("tableBody");
    if (tableHeader) {
        tableHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    document.getElementById("t_name").value = "";
    document.getElementById("t_birth").value = "";
    document.getElementById("t_home").value = "";
    document.getElementById("t_deathYear").value = "";
    currentPage = 1;
    renderTable();
}

// Đóng/mở menu điều hướng trên thiết bị di động
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    if (nav) nav.classList.toggle("show");
}

// Chuyển hướng đến trang lỗi khi mất kết nối mạng
window.addEventListener('offline', function() {
    window.location.href = "error.html";
});
