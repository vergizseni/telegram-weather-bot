import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";

const DEBUG = true;

dotenv.config();

// Хранилища данных
const awaitingCity = new Set(); // Кто ждет ввода города
const userCity = new Map(); // Для кого какой город сохранили

const bot = new Telegraf(process.env.BOT_TOKEN);

// Главное меню (кнопки под строкой ввода)
const mainMenu = {
  reply_markup: {
    keyboard: [
      [{ text: "🌤️ Узнать погоду" }],
      [{ text: "❓ Помощь" }, { text: "ℹ️ О боте" }],
    ],
    resize_keyboard: true, // Уменьшает размер кнопок
    one_time_keyboard: false, // Меню остается после нажатия
  },
};

// Команда /start с красивым приветствием
bot.command("start", (ctx) => {
  const userName = ctx.from.first_name;
  const welcomeMessage = `
🌟 *Добро пожаловать, ${userName}!* 🌟

Я *WeatherBot* — твой личный помощник по погоде! ☀️🌧️

Что я умею:
• 📍 Узнавать погоду в любом городе мира
• 🌡️ Показывать температуру, влажность и ветер
• 📅 Делать прогноз на завтра
• 💡 Давать советы по одежде

*Как пользоваться:*
1️⃣ Нажми кнопку "🌤️ Узнать погоду"
2️⃣ Введи название города
3️⃣ Выбери "Сейчас" или "Завтра"

*Примеры городов:* Москва, Санкт-Петербург, Казань, New York, London

Нажми на кнопку ниже, чтобы начать! 👇
  `;

  ctx.replyWithMarkdown(welcomeMessage, mainMenu);
});

// Команда /help
bot.command("help", (ctx) => {
  ctx.replyWithMarkdown(
    `
❓ *Помощь по боту*

*Доступные команды:*
/start - перезапустить бота
/help - показать эту справку
/weather - узнать погоду (быстрый способ)

*Или используй кнопки в меню:*
🌤️ Узнать погоду - начать поиск города
❓ Помощь - показать это сообщение
ℹ️ О боте - информация о боте

*Поддерживаемые города:*
Любые города мира на русском или английском языке.
Например: Москва, СПб, Kazan, New York, London, Paris

*Совет:* Если город не находится, попробуй добавить страну.
Например: "Москва Россия" или "Paris France"
  `,
    mainMenu,
  );
});

// Команда /weather
bot.command("weather", (ctx) => {
  ctx.reply("🌍 *Напиши название города:*", {
    parse_mode: "Markdown",
    ...mainMenu,
  });
  awaitingCity.add(ctx.from.id);
});

// Обработчик кнопок (текстовых команд)
bot.hears("🌤️ Узнать погоду", (ctx) => {
  ctx.reply("🌍 *Напиши название города:*", {
    parse_mode: "Markdown",
    ...mainMenu,
  });
  awaitingCity.add(ctx.from.id);
});

bot.hears("❓ Помощь", (ctx) => {
  ctx.replyWithMarkdown(
    `
❓ *Помощь по боту*

*Доступные команды:*
/start - перезапустить бота
/help - показать эту справку
/weather - узнать погоду (быстрый способ)

*Или используй кнопки в меню:*
🌤️ Узнать погоду - начать поиск города
❓ Помощь - показать это сообщение
ℹ️ О боте - информация о боте

*Поддерживаемые города:*
Любые города мира на русском или английском языке.
Например: Москва, СПб, Kazan, New York, London, Paris

*Совет:* Если город не находится, попробуй добавить страну.
Например: "Москва Россия" или "Paris France"
  `,
    mainMenu,
  );
});

bot.hears("ℹ️ О боте", (ctx) => {
  ctx.replyWithMarkdown(
    `
ℹ️ *О боте*

*WeatherBot* v2.0

*Технологии:*
• Node.js + Telegraf
• Open-Meteo API (бесплатная погода)
• Бесплатный хостинг Bothost

*Особенности:*
• Погода в любой точке мира
• Прогноз на сегодня и завтра
• Советы по одежде
• Красивые иконки погоды ☀️🌧️⛈️

*Автор:* @${ctx.from.username || "пользователь"}

*Поддержка:* Если нашел баг или есть идеи — пиши!
  `,
    mainMenu,
  );
});

// Словарь русских городов
const russianCitiesMap = {
  москва: { name: "Moscow", country: "RU" },
  спб: { name: "Saint Petersburg", country: "RU" },
  "санкт-петербург": { name: "Saint Petersburg", country: "RU" },
  питер: { name: "Saint Petersburg", country: "RU" },
  новосибирск: { name: "Novosibirsk", country: "RU" },
  екатеринбург: { name: "Yekaterinburg", country: "RU" },
  казань: { name: "Kazan", country: "RU" },
  "нижний новгород": { name: "Nizhny Novgorod", country: "RU" },
  челябинск: { name: "Chelyabinsk", country: "RU" },
  омск: { name: "Omsk", country: "RU" },
  самара: { name: "Samara", country: "RU" },
  "ростов-на-дону": { name: "Rostov-on-Don", country: "RU" },
  ростов: { name: "Rostov-on-Don", country: "RU" },
  уфа: { name: "Ufa", country: "RU" },
  красноярск: { name: "Krasnoyarsk", country: "RU" },
  пермь: { name: "Perm", country: "RU" },
  воронеж: { name: "Voronezh", country: "RU" },
  волгоград: { name: "Volgograd", country: "RU" },
};

// Обработчик текстовых сообщений (ввод города)
bot.on("text", async (ctx) => {
  // Игнорируем команды и кнопки меню
  const text = ctx.message.text;
  if (
    text.startsWith("/") ||
    text === "🌤️ Узнать погоду" ||
    text === "❓ Помощь" ||
    text === "ℹ️ О боте"
  ) {
    return;
  }

  if (!awaitingCity.has(ctx.from.id)) return;

  let city = text.trim();

  // Проверяем, есть ли город в списке русских городов
  const cityLower = city.toLowerCase();
  let searchCity = city;
  let forceRussian = false;

  if (russianCitiesMap[cityLower]) {
    searchCity = russianCitiesMap[cityLower].name;
    forceRussian = true;
    if (DEBUG) console.log(`🔍 Русский город: ${city} -> ${searchCity}`);
  }

  if (DEBUG) console.log(`Поиск города: "${searchCity}"`);

  try {
    let location = null;
    let geoRes = null;

    // Если это русский город из списка — ищем в России
    if (forceRussian) {
      geoRes = await axios.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        {
          params: {
            name: searchCity,
            count: 5,
            language: "RU",
            format: "json",
            country_code: "RU",
          },
        },
      );

      if (geoRes.data.results && geoRes.data.results.length > 0) {
        location = geoRes.data.results[0];
        if (DEBUG)
          console.log(`✅ Найден: ${location.name}, ${location.country}`);
      }
    }

    // Если не нашли — ищем в России стандартно
    if (!location) {
      geoRes = await axios.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        {
          params: {
            name: searchCity,
            count: 5,
            language: "RU",
            format: "json",
            country_code: "RU",
          },
        },
      );

      if (geoRes.data.results && geoRes.data.results.length > 0) {
        location = geoRes.data.results[0];
      }
    }

    // Если не нашли в России — ищем везде
    if (!location) {
      if (DEBUG) console.log(`Не найдено в России, ищем везде...`);

      geoRes = await axios.get(
        "https://geocoding-api.open-meteo.com/v1/search",
        {
          params: {
            name: searchCity,
            count: 5,
            language: "RU",
            format: "json",
          },
        },
      );

      if (geoRes.data.results && geoRes.data.results.length > 0) {
        location = geoRes.data.results[0];

        // Специальная обработка для Москвы
        if (cityLower === "москва" && location.country_code === "TJ") {
          if (DEBUG) console.log(`⚠️ Таджикистан, ищем Москву в России...`);
          const moscowRes = await axios.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            {
              params: {
                name: "Moscow",
                count: 1,
                language: "RU",
                format: "json",
                country_code: "RU",
              },
            },
          );
          if (moscowRes.data.results && moscowRes.data.results.length > 0) {
            location = moscowRes.data.results[0];
          }
        }
      }
    }

    if (!location) {
      throw new Error("Город не найден");
    }

    const { latitude, longitude, name, country, country_code } = location;

    userCity.set(ctx.from.id, {
      latitude,
      longitude,
      name: city,
      country,
    });

    const locationInfo = `${city}, ${country}`;

    // Показываем кнопки выбора
    await ctx.reply(`📍 *${locationInfo}*\n\nЧто хотите узнать?`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌤️ Сейчас", callback_data: "weather_now" },
            { text: "📅 Завтра", callback_data: "weather_tomorrow" },
          ],
          [{ text: "🔄 Другой город", callback_data: "another_city" }],
        ],
      },
    });

    awaitingCity.delete(ctx.from.id);
  } catch (error) {
    console.error("Ошибка:", error.message);
    ctx.reply(
      "❌ *Не удалось найти этот город.*\n\n" +
        "Попробуйте:\n" +
        "• проверить написание\n" +
        "• добавить страну (например, 'Москва Россия')\n" +
        "• использовать английское название ('Moscow')",
      { parse_mode: "Markdown", ...mainMenu },
    );
    awaitingCity.delete(ctx.from.id);
  }
});

// Обработчик нажатий на кнопки
bot.action("weather_now", async (ctx) => {
  const userId = ctx.from.id;
  const cityData = userCity.get(userId);

  if (!cityData) {
    await ctx.reply(
      "❌ Город не найден. Нажмите '🌤️ Узнать погоду' чтобы начать.",
      mainMenu,
    );
    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery("🌤️ Загружаю погоду...");

  try {
    const weatherRes = await axios.get(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: cityData.latitude,
          longitude: cityData.longitude,
          current_weather: true,
          hourly: "temperature_2m,relativehumidity_2m,windspeed_10m",
          timezone: "auto",
        },
      },
    );

    const current = weatherRes.data.current_weather;
    const humidity = weatherRes.data.hourly?.relativehumidity_2m?.[0] || "—";
    const locationName = `${cityData.name}, ${cityData.country}`;

    await ctx.reply(
      `🌤️ *Погода в городе ${locationName}*:

${getWeatherIcon(current.weathercode)} ${getWeatherDescription(current.weathercode)}
🌡️ *Температура:* ${current.temperature}°C
💨 *Ветер:* ${current.windspeed} м/с
💧 *Влажность:* ${humidity}%

${getWeatherAdvice(current.temperature)}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "📅 Прогноз на завтра",
                callback_data: "weather_tomorrow",
              },
              { text: "🔄 Другой город", callback_data: "another_city" },
            ],
          ],
        },
      },
    );
  } catch (error) {
    console.error("Ошибка:", error.message);
    await ctx.reply("🌧️ Не удалось получить погоду. Попробуй позже.", mainMenu);
  }
});

// Обработчик для прогноза на завтра
bot.action("weather_tomorrow", async (ctx) => {
  const userId = ctx.from.id;
  const cityData = userCity.get(userId);

  if (!cityData) {
    await ctx.reply(
      "❌ Город не найден. Нажмите '🌤️ Узнать погоду' чтобы начать.",
      mainMenu,
    );
    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery("📅 Загружаю прогноз...");

  try {
    const weatherRes = await axios.get(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: cityData.latitude,
          longitude: cityData.longitude,
          daily: "temperature_2m_max,temperature_2m_min,weathercode",
          timezone: "auto",
          forecast_days: 2,
        },
      },
    );

    const daily = weatherRes.data.daily;
    const tomorrow = {
      max: daily.temperature_2m_max[1],
      min: daily.temperature_2m_min[1],
      weathercode: daily.weathercode[1],
    };

    const locationName = `${cityData.name}, ${cityData.country}`;

    await ctx.reply(
      `📅 *Прогноз на завтра* в городе ${locationName}:

${getWeatherIcon(tomorrow.weathercode)} ${getWeatherDescription(tomorrow.weathercode)}
🌡️ *Максимум:* ${tomorrow.max}°C
🌡️ *Минимум:* ${tomorrow.min}°C

${getWeatherAdvice((tomorrow.max + tomorrow.min) / 2)}`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🌤️ Погода сейчас", callback_data: "weather_now" },
              { text: "🔄 Другой город", callback_data: "another_city" },
            ],
          ],
        },
      },
    );
  } catch (error) {
    console.error("Ошибка:", error.message);
    await ctx.reply(
      "🌧️ Не удалось получить прогноз. Попробуй позже.",
      mainMenu,
    );
  }
});

// Обработчик кнопки "Другой город"
bot.action("another_city", async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply("🌍 *Напиши название другого города:*", {
    parse_mode: "Markdown",
    ...mainMenu,
  });
  awaitingCity.add(ctx.from.id);
});

// Функции для погоды (оставляем без изменений)
function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if (code === 1) return "🌤️";
  if (code === 2) return "⛅";
  if (code === 3) return "☁️";
  if (code >= 45 && code <= 48) return "🌫️";
  if (code >= 51 && code <= 55) return "🌧️";
  if (code >= 56 && code <= 57) return "❄️🌧️";
  if (code >= 61 && code <= 65) return "🌧️";
  if (code >= 66 && code <= 67) return "❄️🌧️";
  if (code >= 71 && code <= 75) return "❄️";
  if (code === 77) return "❄️";
  if (code >= 80 && code <= 82) return "🌧️";
  if (code >= 85 && code <= 86) return "❄️";
  if (code >= 95 && code <= 99) return "⛈️";
  return "🌡️";
}

function getWeatherDescription(code) {
  if (code === 0) return "Ясно";
  if (code === 1) return "Преимущественно ясно";
  if (code === 2) return "Переменная облачность";
  if (code === 3) return "Пасмурно";
  if (code >= 45 && code <= 48) return "Туман";
  if (code >= 51 && code <= 55) return "Морось";
  if (code >= 56 && code <= 57) return "Ледяная морось";
  if (code >= 61 && code <= 65) return "Дождь";
  if (code >= 66 && code <= 67) return "Ледяной дождь";
  if (code >= 71 && code <= 75) return "Снег";
  if (code === 77) return "Снежные зерна";
  if (code >= 80 && code <= 82) return "Ливень";
  if (code >= 85 && code <= 86) return "Снегопад";
  if (code >= 95 && code <= 99) return "Гроза";
  return "—";
}

function getWeatherAdvice(temperature) {
  if (temperature < -20)
    return "🥶 Очень холодно! Одевайся теплее и не выходи без шапки.";
  if (temperature < -10) return "🧣 Холодно! Не забудь шапку и шарф.";
  if (temperature < 0) return "🧥 Прохладно. Возьми с собой теплую куртку.";
  if (temperature < 10) return "🧥 Прохладно. Лучше надеть куртку.";
  if (temperature < 20)
    return "😊 Отличная погода! Можно гулять в легкой одежде.";
  if (temperature < 30) return "🌞 Тепло! Не забудь про головной убор и воду.";
  return "🔥 Очень жарко! Пей больше воды и избегай солнца в пик дня.";
}

// Запускаем бота
bot.launch().then(() => {
  console.log("🤖 Бот успешно запущен! 🚀");
  console.log("Используется API погоды: Open-Meteo (бесплатно, без ключа)");
});

// Обработка остановки бота
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
