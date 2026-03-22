import http from 'k6/http';
import { sleep, check } from 'k6';

const TARGET_URL = 'http://localhost/productpage';

export const options = {
  vus: 2,           // Chỉ dùng 2 User để tạo ra những request nhẹ nhàng nhất
  duration: '3m',   // Đo trong 3 phút để lấy mức trung bình chuẩn xác
};

export default function () {
  const res = http.get(TARGET_URL);
  check(res, { 'status is 200': (r) => r.status === 200 });
  // không tạo ra bất kỳ áp lực tính toán nào lên hệ thống.
  sleep(3); 
}
