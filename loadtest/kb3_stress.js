import http from 'k6/http';
import { sleep, check } from 'k6';

const TARGET_URL = 'http://localhost/productpage';

export const options = {
  stages: [
    { duration: '10s', target: 10 }, { duration: '2m', target: 10 },   //State 1: 10 users
    { duration: '10s', target: 50 }, { duration: '2m', target: 50 },   //State 2: 50 users
    { duration: '10s', target: 100 }, { duration: '2m', target: 100 }, //State 3: 100 users
    { duration: '10s', target: 200 }, { duration: '2m', target: 200 }, //State 4: 200 users
    { duration: '10s', target: 300 }, { duration: '2m', target: 300 }, //State 5: 300 users
    { duration: '30s', target: 0 }, //Cooldown to 0
  ],
};

export default function () {
  const res = http.get(TARGET_URL, { timeout: '5s' }); //Time out after 5s
  check(res, { 'status is 200': (r) => r.status === 200 });
  sleep(1); 
}
