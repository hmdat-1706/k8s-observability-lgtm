import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '10s', target: 50 },  // Tăng tốc lên 50 user trong 10 giây
    { duration: '30s', target: 50 },  // Giữ mức 50 user trong 30 giây
    { duration: '10s', target: 0 },   // Giảm dần về 0 user
  ],
};

export default function () {
  // Thay <IP-Máy-Ảo> bằng IP thực tế của bạn
  const res = http.get('http://192.168.3.134/productpage');
  
  check(res, {
    'status là 200': (r) => r.status === 200,
  });
  
  sleep(1); // Mỗi user nghỉ 1 giây trước khi request tiếp
}
