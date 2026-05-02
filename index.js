const express = require('express');
const app = express();

app.use(express.json());

// ✅ これが超重要（LINEの入口）
app.post('/callback', (req, res) => {
  console.log("📩 LINEから受信:", JSON.stringify(req.body, null, 2));

  res.status(200).send('OK');
});

// テスト用
app.get('/', (req, res) => {
  res.send('Server is running!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server started on ${PORT}`);
});

