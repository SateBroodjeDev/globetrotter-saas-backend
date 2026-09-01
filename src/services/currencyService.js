const https = require('https');
const { redisClient } = require('../config/redis');
const EXCHANGE_RATES = require('../constants/exchangeRates');

const CACHE_TTL_SECONDS = 60 * 60 * 24;
const CACHE_PREFIX = 'currency:rates:';

const COMMON_TRAVEL_CURRENCIES = ['EUR', 'USD', 'GBP', 'JPY', 'SEK', 'CHF', 'THB', 'AUD', 'CAD', 'NOK', 'DKK', 'SGD'];

const inMemoryRateCache = new Map();

function requestJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

class CurrencyService {
  normalizeHistoricalDate(date) {
    if (!date) {
      return null;
    }

    const normalizedDate = String(date).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)) {
      const error = new Error('Invalid historical date format. Use YYYY-MM-DD');
      error.statusCode = 400;
      throw error;
    }

    return normalizedDate;
  }

  getSupportedCurrencies() {
    return COMMON_TRAVEL_CURRENCIES;
  }

  async getRates(date = null) {
    const normalizedDate = this.normalizeHistoricalDate(date);
    const dateKey = normalizedDate || 'latest';
    const cacheKey = `${CACHE_PREFIX}${dateKey}`;

    if (redisClient?.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } else if (inMemoryRateCache.has(cacheKey)) {
      return inMemoryRateCache.get(cacheKey);
    }

    const rates = await this.fetchRates(normalizedDate);

    if (redisClient?.isOpen) {
      await redisClient.set(cacheKey, JSON.stringify(rates), { EX: CACHE_TTL_SECONDS });
    } else {
      inMemoryRateCache.set(cacheKey, rates);
    }

    return rates;
  }

  async fetchRates(date = null) {
    const appId = process.env.OPENEXCHANGERATES_APP_ID;
    if (!appId) {
      return EXCHANGE_RATES;
    }

    const safeDate = this.normalizeHistoricalDate(date);
    const query = new URLSearchParams({ app_id: appId }).toString();
    const path = safeDate
      ? `https://openexchangerates.org/api/historical/${safeDate}.json?${query}`
      : `https://openexchangerates.org/api/latest.json?${query}`;

    const response = await requestJson(path);
    if (!response?.rates || !response.rates.EUR) {
      return EXCHANGE_RATES;
    }

    const eurBaseRates = {};
    Object.entries(response.rates).forEach(([currency, usdRate]) => {
      eurBaseRates[currency] = usdRate / response.rates.EUR;
    });

    return eurBaseRates;
  }

  async convertToEUR(amount, currency, date = null) {
    const normalizedCurrency = (currency || 'EUR').toUpperCase();
    if (normalizedCurrency === 'EUR') {
      return { amount: Number(amount), rate: 1 };
    }

    const rates = await this.getRates(date);
    const rate = rates[normalizedCurrency];

    if (!rate) {
      const error = new Error(`Unsupported currency: ${normalizedCurrency}`);
      error.statusCode = 400;
      throw error;
    }

    return {
      amount: Number(amount) / Number(rate),
      rate: Number(rate)
    };
  }
}

module.exports = new CurrencyService();
