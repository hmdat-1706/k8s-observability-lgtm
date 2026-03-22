import http from 'k6/http';
import { sleep, check } from 'k6';

const TARGET_URL = 'http://localhost/productpage';

export const options = {
  stages: [
    { duration: '1m', target: 20 },   // Chạy nhẹ 20 users
    { duration: '10s', target: 400 }, // SPIKE: Tăng vọt lên 400 users trong 10 giây
    { duration: '1m', target: 400 },  // Duy trì đỉnh Spike trong 60 giây
    { duration: '10s', target: 20 },  // Rút quân về lại mức bình thường
    { duration: '3m', target: 20 },   // Duy trì mức thấp để xem HPA có tự động thu hồi Pod không
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const res = http.get(TARGET_URL);
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1); 
}
