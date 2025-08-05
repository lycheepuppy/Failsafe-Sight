"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cors_1 = require("cors");
const guardrails_js_1 = require("./guardrails.js");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.post('/v1/guardrails/check', (req, res) => {
    const { input, reasoning, output } = req.body;
    const result = (0, guardrails_js_1.checkGuardrails)(input, reasoning, output);
    res.json(result);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
