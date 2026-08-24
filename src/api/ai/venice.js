const axios = require('axios');

module.exports = function(app) {

    async function venicechat(question) {
        try {
            if (!question) throw new Error('Question is required');
            if (!process.env.VENICE_API_KEY) {
                const error = new Error('VENICE_API_KEY no está configurada');
                error.statusCode = 503;
                throw error;
            }

            const { data } = await axios.request({
                method: 'POST',
                url: 'https://api.venice.ai/api/v1/chat/completions',
                headers: {
                    'content-type': 'application/json',
                    authorization: `Bearer ${process.env.VENICE_API_KEY}`
                },
                data: {
                    model: process.env.VENICE_MODEL || 'venice-uncensored',
                    messages: [{ role: 'user', content: question }],
                    temperature: 0.8,
                    top_p: 0.9
                }
            });

            return data.choices?.[0]?.message?.content?.trim() || '';

        } catch (err) {
            const error = new Error(err.response?.data?.error?.message || err.message || 'Unknown error');
            error.statusCode = err.statusCode || (err.response?.status >= 400 ? 502 : 500);
            throw error;
        }
    }

    // Route API
    app.get('/ai/venice', async (req, res) => {
        const { message } = req.query;

        if (!message) {
            return res.status(400).json({
                status: false,
                error: "Pesan wajib diisi"
            });
        }

        try {
            const result = await venicechat(message);
            res.json({
                status: true,
                creator: "Z7:林企业",
                result
            });
        } catch (error) {
            res.status(error.statusCode || 500).json({
                status: false,
                error: error.message
            });
        }
    });
};
