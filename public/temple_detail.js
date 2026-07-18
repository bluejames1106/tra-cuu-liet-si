// Copy lại mảng demo để trang chi tiết đọc được
let templeList = [
    { name: "Trần Văn F", birth: "1920", home: "Thái Bình", deathYear: "1954", unit: "Tiểu đoàn 3", deathPlace: "Điện Biên Phủ", board: "A", row: "1", col: "5", bio: "Tham gia kháng chiến chống Pháp..." },
    { name: "Lê Thị G", birth: "1945", home: "Hà Tĩnh", deathYear: "1968", unit: "TNXP Tuyến 559", deathPlace: "Đường Trường Sơn", board: "B", row: "3", col: "12", bio: "Nữ thanh niên xung phong..." },
    { name: "Phạm Văn H", birth: "1950", home: "Quảng Nam", deathYear: "1972", unit: "Đại đội 1", deathPlace: "Quảng Trị", board: "C", row: "2", col: "8", bio: "Hy sinh tại mặt trận phía Nam..." }
];

window.onload = function() {
    const urlParams = new URLSearchParams(window.location.search);
    const indexStr = urlParams.get('id');

    // Kiểm tra xem ID (vị trí mảng) truyền sang có hợp lệ không
    if (indexStr === null || indexStr === "" || isNaN(indexStr)) {
        alert("Không tìm thấy thông tin!");
        window.location.href = "temple.html";
        return;
    }

    const index = parseInt(indexStr);
    const data = templeList[index];

    if (!data) {
        alert("Thông tin không tồn tại!");
        window.location.href = "temple.html";
        return;
    }

    // Đổ dữ liệu vào các ô
    document.getElementById("p_name").innerText = data.name || "Liệt sĩ";
    document.getElementById("p_birth").innerText = data.birth || "";
    document.getElementById("p_home").innerText = data.home || "";
    document.getElementById("p_death").innerText = data.deathYear || "";
    document.getElementById("p_deathPlace").innerText = data.deathPlace || "";
    document.getElementById("p_unit").innerText = data.unit || "";
    document.getElementById("p_board").innerText = data.board || "";
    document.getElementById("p_row").innerText = data.row || "";
    document.getElementById("p_col").innerText = data.col || "";
    document.getElementById("p_bio").innerText = data.bio || "Đang cập nhật...";
};
