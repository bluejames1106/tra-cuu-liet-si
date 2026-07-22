/**
 * ==========================================================================
 * JAVASCRIPT XỬ LÝ LOGIC RIÊNG CHO TRANG CHỦ
 * ==========================================================================
 */

// Hàm Đóng/Mở thanh Menu điều hướng (Thực thi khi nhấn nút 3 gạch trên Điện thoại)
function toggleMenu() {
    const navLinks = document.getElementById("navLinks");
    if (navLinks) {
        // Tận dụng class .show đang có sẵn trong file dashboard.css của bạn
        navLinks.classList.toggle("show");
    }
}
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
// Bạn có thể mở rộng thêm các tính năng tương tác của trang chủ tại đây trong tương lai
console.log("Trang chủ đã được tải và sẵn sàng hoạt động ổn định!");
