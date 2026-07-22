window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id'); // Nhận ID từ trang danh sách

    if (!id) {
        alert("Không tìm thấy thông tin liệt sĩ!");
        window.location.href = "temple.html";
        return;
    }

    try {
        // Gọi API lấy chi tiết từ SQL / Google Sheet
        const response = await fetch(`/api/shrine-martyrs/${id}`);
        
        if (response.status === 404) {
            alert("Thông tin liệt sĩ không tồn tại trên hệ thống!");
            window.location.href = "temple.html";
            return;
        }

        if (!response.ok) throw new Error('Lỗi mạng hoặc lỗi hệ thống máy chủ');

        const data = await response.json();

        // TRÍCH XUẤT CHÍNH XÁC GIÁ TRỊ "BẢNG" TỪ GOOGLE SHEET TÙY THEO CÁCH ĐẶT TÊN CỘT
        const boardValue = data.board || data.bang || data.bia || data.b_so || "";

        // Đổ dữ liệu trích xuất vào giao diện
        document.getElementById("p_name").innerText = data.name || "Liệt sĩ";
        document.getElementById("p_birth").innerText = data.birth || "";
        document.getElementById("p_home").innerText = data.home || "";
        document.getElementById("p_death").innerText = data.deathYear || "";
        document.getElementById("p_title").innerText = data.danh_hieu || data.title || ""; 
        document.getElementById("p_unit").innerText = data.unit || "";
        
        // Hiển thị thông tin Bảng thực tế từ Google Sheet (nếu trống sẽ ghi "Chưa cập nhật")
        document.getElementById("p_board").innerText = boardValue || "Chưa cập nhật";
        document.getElementById("p_row").innerText = data.row || "";
        document.getElementById("p_col").innerText = data.col || "";
        document.getElementById("p_bio").innerText = data.bio || "Tiểu sử trích ngang";

        // --- ĐOẠN XỬ LÝ VẼ SƠ ĐỒ HÀNG CỘT ---
        const targetRow = parseInt(data.row);
        const targetCol = parseInt(data.col);
        const gridElement = document.getElementById("shrine_grid");
        const statusElement = document.getElementById("map_status");

        // Kiểm tra xem dữ liệu hàng và cột có hợp lệ không
        if (isNaN(targetRow) || isNaN(targetCol) || targetRow <= 0 || targetCol <= 0) {
            statusElement.innerText = "⚠️ Chưa cập nhật thông tin Hàng/Cột cụ thể trong cơ sở dữ liệu để vẽ sơ đồ.";
            gridElement.style.display = "none";
        } else {
            // Hiển thị tên Bảng trích xuất thực tế (không tự động ép về Bảng 1 nữa)
            const boardText = boardValue ? `Bảng ${boardValue}` : "Chưa xác định Bảng";
            statusElement.innerHTML = `Vị trí hiển thị: <strong>${boardText} — Hàng ${targetRow}, Cột ${targetCol}</strong> (Biểu tượng ★ nổi bật).`;
            
            // Xác định kích thước bảng mô phỏng
            const maxRows = Math.max(8, targetRow + 2); 
            const maxCols = Math.max(12, targetCol + 2);

            let tableHTML = "";

            // 1. Tạo hàng tiêu đề trên cùng (Cột 1, Cột 2...)
            tableHTML += "<tr><td class='shrine-header-cell'>H\\C</td>";
            for (let c = 1; c <= maxCols; c++) {
                tableHTML += `<td class='shrine-header-cell'>${c}</td>`;
            }
            tableHTML += "</tr>";

            // 2. Vòng lặp dựng các hàng và ô lưới
            for (let r = 1; r <= maxRows; r++) {
                tableHTML += "<tr>";
                // Ô đầu tiên ghi số Hàng
                tableHTML += `<td class='shrine-header-cell'>${r}</td>`;
                
                for (let c = 1; c <= maxCols; c++) {
                    let cellClass = "shrine-cell";
                    let cellContent = "";

                    // Highlight đường gióng Hàng / Cột
                    if (r === targetRow || c === targetCol) {
                        cellClass += " shrine-highlight-line";
                    }

                    // Ô giao điểm chính xác (Vị trí Liệt sĩ)
                    if (r === targetRow && c === targetCol) {
                        cellClass += " shrine-cell-active";
                        cellContent = "★"; // Đặt ngôi sao đỏ nổi bật
                    }

                    tableHTML += `<td class="${cellClass}">${cellContent}</td>`;
                }
                tableHTML += "</tr>";
            }

            // Xuất HTML ra màn hình giao diện
            gridElement.innerHTML = tableHTML;
            gridElement.style.display = "table";
        }

    } catch (error) {
        console.error("Lỗi tải trang chi tiết đền thờ:", error);
        alert("Đã xảy ra lỗi khi tải dữ liệu chi tiết từ cơ sở dữ liệu đám mây!");
    }
};
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
// Hàm Đóng/Mở Menu trên điện thoại
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    if (nav) nav.classList.toggle("show");
}
