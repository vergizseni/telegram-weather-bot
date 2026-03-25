import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

// Хранилища данных
const awaitingCity = new Set(); // Кто ждет ввода города
const userCity = new Map(); // Для кого какой город сохранили

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.command("start", (ctx) => {
  ctx.reply(`Привет, ${ctx.from.first_name}!👋
Я твой первый бот. Используй /help чтобы узнать что я умею.`);
});

bot.command("help", (ctx) => {
  ctx.reply(
    `Доступные команды: 
    /start - начать работу 
    /help - получить справку 
    /weather - узнать погоду`,
  );
});

// Единый обработчик /weather
bot.command("weather", (ctx) => {
  ctx.reply("🌍 Напиши название города, чтобы узнать погоду:");
  awaitingCity.add(ctx.from.id);
});

// Обработчик текстовых сообщений (ввод города)
bot.on("text", async (ctx) => {
  // Проверяем, ждем ли мы город от этого пользователя
  if (!awaitingCity.has(ctx.from.id)) return;

  const city = ctx.message.text.trim();

  try {
    // Получаем координаты города
    const geoRes = await axios.get(
      "https://geocoding-api.open-meteo.com/v1/search",
      {
        params: {
          name: city,
          count: 10,
          language: "RU",
          format: "json",
        },
      },
    );

    if (!geoRes.data.results || geoRes.data.results.length === 0) {
      throw new Error("Город не найден");
    }

    const location = null;

    // Приоритет: Россия > Беларусь > Казахстан > другие страны СНГ
    const priorityCountries = [
      "RU",
      "BY",
      "KZ",
      "UA",
      "GE",
      "AM",
      "AZ",
      "KG",
      "UZ",
      "TJ",
      "TM",
      "MD",
    ];

    // Сначала ищем среди приоритетных стран
    for (const countryCode of priorityCountries) {
      location = geoRes.data.results.find(
        (loc) => loc.country_code === countryCode,
      );
      if (location) break;
    }

    // Если не нашли среди приоритетных — берем первый результат
    if (!location) {
      location = geoRes.data.results[0];
    }

    // Если нашли несколько городов в России — выбираем самый крупный по населению
    const russianCities = geoRes.data.results.filter(
      (loc) => loc.country_code === "RU",
    );

    if (russianCities.length > 1) {
      // Сортируем по населению (от большего к меньшему)
      russianCities.sort((a, b) => (b.population || 0) - (a.population || 0));
      location = russianCities[0];
    }
    const { latitude, longitude, name, country } = location;

    // Сохраняем координаты города для этого пользователя
    userCity.set(ctx.from.id, {
      latitude,
      longitude,
      name,
      country,
    });

    // Показываем кнопки с выбором
    ctx.reply(
      `📍 Город: ${country ? `${name}, ${country}` : name}\n\nЧто хотите узнать?`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🌤️ Погода сейчас", callback_data: "weather_now" },
              {
                text: "📅 Прогноз на завтра",
                callback_data: "weather_tomorrow",
              },
            ],
          ],
        },
      },
    );

    // Убираем из ожидания ввода города
    awaitingCity.delete(ctx.from.id);
  } catch (error) {
    console.error("Ошибка при получении города:", error.message);
    ctx.reply(
      "❌ Не удалось найти этот город. Проверь правильность написания и попробуй снова.",
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
      "❌ Город не найден. Используйте /weather чтобы начать заново.",
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
    const locationName = cityData.country
      ? `${cityData.name}, ${cityData.country}`
      : cityData.name;

    await ctx.reply(`🌤️ Погода в городе ${locationName}:

${getWeatherIcon(current.weathercode)} ${getWeatherDescription(current.weathercode)}
🌡️ Температура: ${current.temperature}°C
💨 Ветер: ${current.windspeed} м/с
💧 Влажность: ${humidity}%

${getWeatherAdvice(current.temperature)}`);
  } catch (error) {
    console.error("Ошибка:", error.message);
    await ctx.reply("🌧️ Не удалось получить погоду. Попробуй позже.");
  }
});

// Обработчик для прогноза на завтра
bot.action("weather_tomorrow", async (ctx) => {
  const userId = ctx.from.id;
  const cityData = userCity.get(userId);

  if (!cityData) {
    await ctx.reply(
      "❌ Город не найден. Используйте /weather чтобы начать заново.",
    );
    await ctx.answerCbQuery();
    return;
  }

  await ctx.answerCbQuery("📅 Загружаю прогноз на завтра...");

  try {
    const weatherRes = await axios.get(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: cityData.latitude,
          longitude: cityData.longitude,
          daily: "temperature_2m_max,temperature_2m_min,weathercode",
          timezone: "auto",
          forecast_days: 2, // Нужно 2 дня, чтобы получить завтра
        },
      },
    );

    const daily = weatherRes.data.daily;
    const tomorrow = {
      max: daily.temperature_2m_max[1],
      min: daily.temperature_2m_min[1],
      weathercode: daily.weathercode[1],
    };

    const locationName = cityData.country
      ? `${cityData.name}, ${cityData.country}`
      : cityData.name;

    await ctx.reply(`📅 Прогноз погоды на завтра в городе ${locationName}:

${getWeatherIcon(tomorrow.weathercode)} ${getWeatherDescription(tomorrow.weathercode)}
🌡️ Максимум: ${tomorrow.max}°C
🌡️ Минимум: ${tomorrow.min}°C

${getWeatherAdvice((tomorrow.max + tomorrow.min) / 2)}`);
  } catch (error) {
    console.error("Ошибка:", error.message);
    await ctx.reply("🌧️ Не удалось получить прогноз. Попробуй позже.");
  }
});

// Функция для определения иконки погоды по коду
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

// Функция для описания погоды
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

// Функция с полезным советом по погоде
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
