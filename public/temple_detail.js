window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id'); // Nhận ID khóa chính (số thứ tự gốc) truyền từ trang danh sách sang

    if (!id) {
        alert("Không tìm thấy thông tin liệt sĩ!");
        window.location.href = "temple.html";
        return;
    }

    try {
        // Gọi API chuyên biệt để lấy chi tiết thông tin liệt sĩ trong đền thờ từ SQL
        const response = await fetch(`/api/shrine-martyrs/${id}`);
        
        if (response.status === 404) {
            alert("Thông tin liệt sĩ không tồn tại trên hệ thống!");
            window.location.href = "temple.html";
            return;
        }

        if (!response.ok) throw new Error('Lỗi mạng hoặc lỗi hệ thống máy chủ');

        const data = await response.json();

        // Đổ toàn bộ dữ liệu trả về vào các thẻ ID HTML tương ứng trên trang chi tiết
        document.getElementById("p_name").innerText = data.name || "Liệt sĩ";
        document.getElementById("p_birth").innerText = data.birth || "";
        document.getElementById("p_home").innerText = data.home || "";
        document.getElementById("p_death").innerText = data.deathYear || "";
        
        // --- ĐÃ SỬA: Thay thế Nơi hy sinh thành Danh hiệu ---
        document.getElementById("p_title").innerText = data.danh_hieu || data.title || ""; 
        
        document.getElementById("p_unit").innerText = data.unit || "";
        document.getElementById("p_board").innerText = data.board || "";
        document.getElementById("p_row").innerText = data.row || "";
        document.getElementById("p_col").innerText = data.col || "";
        document.getElementById("p_bio").innerText = data.bio || "Tiểu sử trích ngang";

        // --- ĐOẠN XỬ LÝ VẼ SƠ ĐỒ HÀNG CỘT TỰ ĐỘNG ---
        const targetRow = parseInt(data.row);
        const targetCol = parseInt(data.col);
        const gridElement = document.getElementById("shrine_grid");
        const statusElement = document.getElementById("map_status");

        // Kiểm tra xem dữ liệu hàng và cột có hợp lệ không
        if (isNaN(targetRow) || isNaN(targetCol) || targetRow <= 0 || targetCol <= 0) {
            statusElement.innerText = "⚠️ Chưa cập nhật thông tin Hàng/Cột cụ thể trong cơ sở dữ liệu để vẽ sơ đồ.";
            gridElement.style.display = "none";
        } else {
            statusElement.innerHTML = `Vị trí hiển thị: <strong>Bảng ${data.board || 1} — Hàng ${targetRow}, Cột ${targetCol}</strong> (Ô màu hồng nổi bật).`;
            
            // Xác định kích thước bảng mô phỏng (Tự động mở rộng kích thước nếu hàng/cột lớn hơn 10)
            const maxRows = Math.max(8, targetRow + 2); 
            const maxCols = Math.max(12, targetCol + 2);

            let tableHTML = "";

            // 1. Tạo hàng tiêu đề trên cùng để đánh số Cột (Cột 1, Cột 2...)
            tableHTML += "<tr><td class='shrine-header-cell'>H\\C</td>";
            for (let c = 1; c <= maxCols; c++) {
                tableHTML += `<td class='shrine-header-cell'>${c}</td>`;
            }
            tableHTML += "</tr>";

            // 2. Vòng lặp dựng các hàng và ô lưới
            for (let r = 1; r <= maxRows; r++) {
                tableHTML += "<tr>";
                // Ô đầu tiên của mỗi hàng dùng để ghi số Hàng (Hàng 1, Hàng 2...)
                tableHTML += `<td class='shrine-header-cell'>${r}</td>`;
                
                for (let c = 1; c <= maxCols; c++) {
                    let cellClass = "shrine-cell";
                    let cellContent = ""; // Mặc định để trống không ghi tên theo yêu cầu của bạn

                    // Nếu nằm trên cùng hàng hoặc cùng cột mục tiêu -> Thêm class highlight đường dẫn
                    if (r === targetRow || c === targetCol) {
                        cellClass += " shrine-highlight-line";
                    }

                    // Nếu là ô giao điểm chính xác của Hàng và Cột
                    if (r === targetRow && c === targetCol) {
                        cellClass += " shrine-cell-active";
                        cellContent = "★"; // Ghi ký hiệu hoặc để trống tùy bạn, ở đây ghi chữ ngắn để dễ nhìn
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

// Hàm Đóng/Mở Menu trên điện thoại
function toggleMenu() {
    const nav = document.getElementById("navLinks");
    nav.classList.toggle("show");
}
