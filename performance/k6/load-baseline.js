import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 20,
  duration: "3m",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<750", "p(99)<1500"],
  },
};

const base = __ENV.TARGET_URL || "http://localhost:8080";

export default function () {
  const health = http.get(`${base}/healthz/`);
  check(health, {
    "health status 200": (r) => r.status === 200,
  });

  const home = http.get(`${base}/`);
  check(home, {
    "home status 200": (r) => r.status === 200,
  });

  const store = http.get(`${base}/store/`);
  check(store, {
    "store status 200": (r) => r.status === 200,
  });

  sleep(1);
}
