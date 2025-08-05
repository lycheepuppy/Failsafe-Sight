const express = require('express');
const cors = require('cors');
const { checkGuardrails } = require('./guardrails');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/v1/guardrails/check', (req: any, res: any) => {
  const { input, reasoning, output } = req.body;
  const result = checkGuardrails(input, reasoning, output);
  res.json(result);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});