import http from 'k6/http';
import { sleep, check } from 'k6';

const TARGET_URL = 'http://localhost/productpage';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, { duration: '2m', target: 10 },
    { duration: '10s', target: 50 }, { duration: '2m', target: 50 },
    { duration: '10s', target: 100 }, { duration: '2m', target: 100 },
    { duration: '10s', target: 200 }, { duration: '2m', target: 200 },
    { duration: '10s', target: 300 }, { duration: '2m', target: 300 },
    { duration: '10s', target: 20 },  //Reduce users count to a low amount
    { duration: '3m', target: 20 },   //Idle to see if the HPA reduce replicas
    { duration: '10s', target: 0 },
  ],
};

export default function () {
  const res = http.get(TARGET_URL, { timeout: '5s' });
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1); 
}
