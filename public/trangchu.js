/* ==========================================================================
   TRANGCHU.JS - Xử lý logic giao diện dành riêng cho Trang chủ
   ========================================================================== */

// Đóng/mở menu điều hướng trên thiết bị di động
function toggleMenu() {
    const navLinks = document.getElementById("navLinks");
    if (navLinks) {
        navLinks.classList.toggle("show");
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

// Chuyển hướng đến trang lỗi khi mất kết nối mạng
window.addEventListener('offline', function() {
    window.location.href = "error.html";
});
