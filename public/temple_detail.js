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
        document.getElementById("p_birth").innerText = data.birth || "Trống";
        document.getElementById("p_home").innerText = data.home || "Trống";
        document.getElementById("p_death").innerText = data.deathYear || "Trống";
        document.getElementById("p_deathPlace").innerText = data.deathPlace || "Trống";
        document.getElementById("p_unit").innerText = data.unit || "Trống";
        document.getElementById("p_board").innerText = data.board || "Trống";
        document.getElementById("p_row").innerText = data.row || "Trống";
        document.getElementById("p_col").innerText = data.col || "Trống";
        document.getElementById("p_bio").innerText = data.bio || "Đang cập nhật thông tin tiểu sử...";

    } catch (error) {
        console.error("Lỗi tải trang chi tiết đền thờ:", error);
        alert("Đã xảy ra lỗi khi tải dữ liệu chi tiết từ cơ sở dữ liệu đám mây!");
    }
};
