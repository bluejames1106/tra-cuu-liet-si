/* ==========================================================================
   DETAIL.JS - Xử lý hiển thị thông tin chi tiết liệt sĩ
   ========================================================================== */

// Lấy thông tin chi tiết khi trang được tải
window.onload = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id'); // Lấy tham số ID từ URL

    if (!id) {
        alert("Không tìm thấy thông tin liệt sĩ!");
        window.location.href = "index.html";
        return;
    }

    try {
        // Gửi yêu cầu lấy dữ liệu chi tiết theo ID
        const response = await fetch(`/api/martyrs/${id}`);
        
        if (response.status === 404) {
            alert("Thông tin liệt sĩ không tồn tại trong hệ thống!");
            window.location.href = "index.html";
            return;
        }

        if (!response.ok) throw new Error('Lỗi kết nối mạng hoặc lỗi server');

        const data = await response.json();
        
        // Hiển thị thông tin cá nhân
        document.getElementById("p_name").innerText = data.ho_va_ten || "Liệt sĩ";
        document.getElementById("p_birth").innerText = data.nam_sinh || "";
        document.getElementById("p_home").innerText = data.que_quan || "";
        document.getElementById("p_death").innerText = data.ngay_hy_sinh || "";
        document.getElementById("p_deathPlace").innerText = data.noi_hy_sinh || "";
        document.getElementById("p_unit").innerText = data.don_vi || "";
        
        // Hiển thị thông tin vị trí phần mộ
        document.getElementById("p_area").innerText = data.khu_lo || data.khu || "";
        document.getElementById("p_row").innerText = data.hang || "";
        document.getElementById("p_grave").innerText = data.so_mo || "";
        
        // Hiển thị tiểu sử
        document.getElementById("p_bio").innerText = data.tieu_su || "Đang cập nhật";

        // Hiển thị thông tin sở thích (nếu có thẻ tương ứng trên giao diện)
        const hobbyElement = document.getElementById("p_hobby");
        if (hobbyElement) {
            hobbyElement.innerText = data.so_thich || "Trống";
        }

    } catch (error) {
        console.error("Lỗi tải chi tiết:", error);
        alert("Lỗi khi tải chi tiết dữ liệu từ cơ sở dữ liệu!");
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
    nav.classList.toggle("show");
}

// Chuyển hướng đến trang lỗi khi mất kết nối mạng
window.addEventListener('offline', function() {
    window.location.href = "error.html";
});
