import http from 'k6/http';
import { sleep, check } from 'k6';

const TARGET_URL = 'http://localhost/productpage';

export const options = {
  vus: 10,
  duration: '3m', // Duy trì mức tải nhỏ đều đặn trong 3 phút
  thresholds: {
    http_req_failed: ['rate<0.01'], // Kỳ vọng lỗi < 1%
  },
};

export default function () {
  const res = http.get(TARGET_URL);
  check(res, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1); // Giả lập user dừng lại 1 giây để đọc nội dung
}
