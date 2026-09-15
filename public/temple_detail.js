/* ==========================================================================
   TEMPLE_DETAIL.JS - Hiển thị chi tiết liệt sĩ trong Đền thờ và sơ đồ vị trí
   ========================================================================== */

// Tải chi tiết dữ liệu khi mở trang
window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (!id) {
        alert("Không tìm thấy thông tin liệt sĩ!");
        window.location.href = "temple.html";
        return;
    }

    try {
        // Gửi yêu cầu truy xuất dữ liệu từ Backend
        const response = await fetch(`/api/shrine-martyrs/${id}`);
        
        if (response.status === 404) {
            alert("Thông tin liệt sĩ không tồn tại trên hệ thống!");
            window.location.href = "temple.html";
            return;
        }

        if (!response.ok) throw new Error('Lỗi mạng hoặc lỗi hệ thống máy chủ');

        const data = await response.json();

        // Thu thập giá trị Bảng từ cơ sở dữ liệu
        const boardValue = data.board || data.bang || data.bia || data.b_so || "";

        // Hiển thị thông tin cá nhân
        document.getElementById("p_name").innerText = data.name || "Liệt sĩ";
        document.getElementById("p_birth").innerText = data.birth || "";
        document.getElementById("p_home").innerText = data.home || "";
        document.getElementById("p_death").innerText = data.deathYear || "";
        document.getElementById("p_title").innerText = data.danh_hieu || data.title || ""; 
        document.getElementById("p_unit").innerText = data.unit || "";
        
        // Hiển thị thông tin vị trí trong Đền
        document.getElementById("p_board").innerText = boardValue || "Chưa cập nhật";
        document.getElementById("p_row").innerText = data.row || "";
        document.getElementById("p_col").innerText = data.col || "";
        document.getElementById("p_bio").innerText = data.bio || "Đang cập nhật";

        // ==========================================
        // XỬ LÝ VẼ SƠ ĐỒ VỊ TRÍ (MA TRẬN HÀNG/CỘT)
        // ==========================================
        const targetRow = parseInt(data.row);
        const targetCol = parseInt(data.col);
        const gridElement = document.getElementById("shrine_grid");
        const statusElement = document.getElementById("map_status");

        // Xử lý ngoại lệ nếu thiếu dữ liệu Hàng/Cột
        if (isNaN(targetRow) || isNaN(targetCol) || targetRow <= 0 || targetCol <= 0) {
            statusElement.innerText = "⚠️ Chưa cập nhật thông tin Hàng/Cột cụ thể trong cơ sở dữ liệu để vẽ sơ đồ.";
            gridElement.style.display = "none";
        } else {
            // Hiển thị chú thích sơ đồ
            const boardText = boardValue ? `Bảng ${boardValue}` : "Chưa xác định Bảng";
            statusElement.innerHTML = `Vị trí hiển thị: <strong>${boardText} — Hàng ${targetRow}, Cột ${targetCol}</strong> (Biểu tượng ★ nổi bật).`;
            
            // Tính toán kích thước lưới ma trận
            const maxRows = Math.max(8, targetRow + 2); 
            const maxCols = Math.max(12, targetCol + 2);

            let tableHTML = "";

            // Tạo hàng tiêu đề trên cùng
            tableHTML += "<tr><td class='shrine-header-cell'>H\\C</td>";
            for (let c = 1; c <= maxCols; c++) {
                tableHTML += `<td class='shrine-header-cell'>${c}</td>`;
            }
            tableHTML += "</tr>";

            // Vòng lặp xây dựng ma trận
            for (let r = 1; r <= maxRows; r++) {
                tableHTML += "<tr>";
                // Ô đầu tiên hiển thị chỉ số Hàng
                tableHTML += `<td class='shrine-header-cell'>${r}</td>`;
                
                for (let c = 1; c <= maxCols; c++) {
                    let cellClass = "shrine-cell";
                    let cellContent = "";

                    // Tạo hiệu ứng đường gióng Hàng/Cột
                    if (r === targetRow || c === targetCol) {
                        cellClass += " shrine-highlight-line";
                    }

                    // Ô giao điểm chứa vị trí Liệt sĩ
                    if (r === targetRow && c === targetCol) {
                        cellClass += " shrine-cell-active";
                        cellContent = "★";
                    }

                    tableHTML += `<td class="${cellClass}">${cellContent}</td>`;
                }
                tableHTML += "</tr>";
            }

            // Đưa bản đồ vào giao diện
            gridElement.innerHTML = tableHTML;
            gridElement.style.display = "table";
        }

    } catch (error) {
        console.error("Lỗi tải trang chi tiết đền thờ:", error);
        alert("Đã xảy ra lỗi khi tải dữ liệu chi tiết từ cơ sở dữ liệu!");
        window.location.href = "error.html";
    }
};

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

// Đóng/mở menu điều hướng trên thiết bị di động
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    if (nav) nav.classList.toggle("show");
}

// Chuyển hướng đến trang lỗi khi mất kết nối mạng
window.addEventListener('offline', function() {
    window.location.href = "error.html";
});
