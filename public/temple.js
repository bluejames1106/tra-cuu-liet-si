let currentPage = 1;
const rowsPerPage = 20;

window.onload = function() {
    renderTable();
    
    // Bắt sự kiện Enter khi người dùng gõ tìm kiếm
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

async function renderTable() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    tableBody.innerHTML = `<tr><td colspan="8" style="padding: 20px;">Đang tải dữ liệu từ cơ sở dữ liệu...</td></tr>`;

    // Thu thập từ khóa tìm kiếm
    const sName = document.getElementById("t_name").value.trim();
    const sBirth = document.getElementById("t_birth").value.trim();
    const sHome = document.getElementById("t_home").value.trim();
    const sDeath = document.getElementById("t_deathYear").value.trim();

    try {
        // Gửi lệnh truy vấn lên SQL thông qua API của Server
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

        if (filteredData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" style="color: red; font-weight: bold; padding: 20px;">Không tìm thấy thông tin phù hợp!</td></tr>`;
            renderPagination(0);
            return;
        }

        // Thực hiện phân trang trên tập dữ liệu trả về từ SQL
        const startIndex = (currentPage - 1) * rowsPerPage;
        const pageData = filteredData.slice(startIndex, startIndex + rowsPerPage);

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
        console.error(error);
        tableBody.innerHTML = `<tr><td colspan="8" style="color: red; padding: 20px;">Không thể kết nối với máy chủ SQL!</td></tr>`;
    }
}

// HÀM PHÂN TRANG ĐÃ ĐƯỢC RÚT GỌN TỐI ƯU CHO MOBILE
function renderPagination(totalRows) {
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const pagination = document.getElementById("pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    if (pageCount <= 1) return; // Nếu chỉ có 1 trang thì không cần hiện nút

    // 1. NÚT TRANG TRƯỚC («)
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

    // 2. THUẬT TOÁN RÚT GỌN NÚT (DẠNG 1 ... 17 [18] 19 ... 27)
    let pages = [];
    const delta = 1; // Số lượng trang hiển thị xung quanh trang hiện tại

    for (let i = 1; i <= pageCount; i++) {
        if (i === 1 || i === pageCount || (i >= currentPage - delta && i <= currentPage + delta)) {
            pages.push(i);
        } else if (pages[pages.length - 1] !== '...') {
            pages.push('...');
        }
    }

    // 3. RENDER CÁC NÚT TRANG
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

    // 4. NÚT TRANG SAU (»)
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

// Hàm hỗ trợ cuộn màn hình lên đầu bảng khi bấm chuyển trang
function scrollToTable() {
    const tableHeader = document.querySelector("table") || document.getElementById("tableBody");
    if (tableHeader) {
        tableHeader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function clearSearch() {
    document.getElementById("t_name").value = "";
    document.getElementById("t_birth").value = "";
    document.getElementById("t_home").value = "";
    document.getElementById("t_deathYear").value = "";
    currentPage = 1;
    renderTable();
}

// Hàm Đóng/Mở Menu trên điện thoại
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    if (nav) nav.classList.toggle("show");
}
