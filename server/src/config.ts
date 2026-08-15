import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 3001),
  finnhubApiKey: process.env.FINNHUB_API_KEY ?? '',
  hasFinnhub: Boolean(process.env.FINNHUB_API_KEY),
};
