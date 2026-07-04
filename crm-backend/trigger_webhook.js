const http = require('http');

function triggerWebhook(id) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ booking_id: id });
    const req = http.request({
      hostname: 'localhost',
      port: 3004,
      path: '/api/webhooks/new-booking',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const bookingIds = ['674483', '699973', '691438'];
  for (const id of bookingIds) {
    try {
      console.log(`Triggering webhook for booking_id: ${id}`);
      const res = await triggerWebhook(id);
      console.log(`Result for ${id}:`, res);
    } catch (err) {
      console.error(`Error triggering for ${id}:`, err);
    }
  }
}
run();
