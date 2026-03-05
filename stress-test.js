import http from 'k6/http';
import { check, sleep } from 'k6';

// Kịch bản: Sốc tải đột ngột để ép CPU vọt ngưỡng
export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Khởi động: Tăng lên 50 user ảo
    { duration: '1m', target: 200 },   // Sốc tải: Bơm vọt lên 200 user liên tục trong 1 phút
    { duration: '30s', target: 0 },    // Xả tải: Hạ nhiệt dần về 0
  ],
};

export default function () {
  // Bắn thẳng vào port 9080 mà chúng ta đã forward
  const url = 'http://127.0.0.1:9080/productpage'; 
  
  const res = http.get(url);
  
  check(res, {
    'Trạng thái 200 OK': (r) => r.status === 200,
  });
  
  // Thời gian nghỉ cực ngắn (0.1s) để bào CPU liên tục
  sleep(0.1); 
}
