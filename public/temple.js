// Dữ liệu mẫu (Demo) chờ Backend tạo SQL
let templeList = [
    { name: "Trần Văn F", birth: "1920", home: "Thái Bình", deathYear: "1954", unit: "Tiểu đoàn 3", deathPlace: "Điện Biên Phủ", board: "A", row: "1", col: "5", bio: "Tham gia kháng chiến chống Pháp..." },
    { name: "Lê Thị G", birth: "1945", home: "Hà Tĩnh", deathYear: "1968", unit: "TNXP Tuyến 559", deathPlace: "Đường Trường Sơn", board: "B", row: "3", col: "12", bio: "Nữ thanh niên xung phong..." },
    { name: "Phạm Văn H", birth: "1950", home: "Quảng Nam", deathYear: "1972", unit: "Đại đội 1", deathPlace: "Quảng Trị", board: "C", row: "2", col: "8", bio: "Hy sinh tại mặt trận phía Nam..." }
];

let currentPage = 1;
const rowsPerPage = 20;

window.onload = function() {
    renderTable();
    
    // Bắt sự kiện Enter
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

function removeTones(str) {
    if (!str) return "";
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function renderTable() {
    const tableBody = document.getElementById("tableBody");
    if (!tableBody) return;
    tableBody.innerHTML = "";

    // Lấy 4 trường tìm kiếm
    const sName = removeTones(document.getElementById("t_name").value.toLowerCase().trim());
    const sBirth = document.getElementById("t_birth").value.toLowerCase().trim();
    const sHome = removeTones(document.getElementById("t_home").value.toLowerCase().trim());
    const sDeath = document.getElementById("t_deathYear").value.toLowerCase().trim();

    // Lọc dữ liệu demo
    const filteredData = templeList.filter(item => {
        const name = removeTones((item.name || "").toLowerCase());
        const birth = (item.birth || "").toLowerCase();
        const home = removeTones((item.home || "").toLowerCase());
        const death = (item.deathYear || "").toLowerCase();

        return name.includes(sName) && birth.includes(sBirth) && 
               home.includes(sHome) && death.includes(sDeath);
    });

    const startIndex = (currentPage - 1) * rowsPerPage;
    const pageData = filteredData.slice(startIndex, startIndex + rowsPerPage);

    if (pageData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="color: red; font-weight: bold; padding: 20px;">Không tìm thấy thông tin phù hợp!</td></tr>`;
        renderPagination(0);
        return;
    }

   pageData.forEach((item, index) => {
        let stt = startIndex + index + 1;
        // Lấy vị trí gốc của mảng để truyền sang trang chi tiết (Giống hệt cách làm của trang Mộ lúc chưa có SQL)
        let originalIndex = templeList.indexOf(item); 
        
        let row = `<tr>
            <td>${stt}</td>
            <td><a href="temple_detail.html?id=${originalIndex}" class="martyr-link">${item.name}</a></td>
            <td>${item.birth}</td>
            <td>${item.home}</td>
            <td>${item.deathYear}</td>
            <td>${item.board}</td>
            <td>${item.row}</td>
            <td>${item.col}</td>
        </tr>`;
        tableBody.innerHTML += row;
    });

    renderPagination(filteredData.length);
}

function renderPagination(totalRows) {
    const pageCount = Math.ceil(totalRows / rowsPerPage);
    const pagination = document.getElementById("pagination");
    pagination.innerHTML = "";
    for (let i = 1; i <= pageCount; i++) {
        let btn = document.createElement("button");
        btn.innerText = i;
        if (i === currentPage) btn.className = "active";
        btn.onclick = () => { currentPage = i; renderTable(); };
        pagination.appendChild(btn);
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
