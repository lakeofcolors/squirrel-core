const { Client } = require('pg');

async function check() {
  const client = new Client({ connectionString: 'postgresql://vladimirkochetkov:@localhost:5432/belka' });
  await client.connect();
  const res = await client.query("SELECT * FROM event_shop_items");
  console.log("ITEMS:", res.rows);
  const events = await client.query("SELECT * FROM events");
  console.log("EVENTS:", events.rows);
  await client.end();
}

check();
