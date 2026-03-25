import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const awaitingCity = new Set();
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

bot.command("weather", (ctx) => {
  ctx.reply("🌍 Напиши название города, чтобы узнать погоду:");
  awaitingCity.add(ctx.from.id);
});

bot.on("text", async (ctx) => {
  // Проверяем, ждем ли мы город от этого пользователя
  if (!awaitingCity.has(ctx.from.id)) return;

  const city = ctx.message.text.trim();

  try {
    // Шаг 1: Получаем координаты города через геокодер Open-Meteo
    const geoRes = await axios.get(
      "https://geocoding-api.open-meteo.com/v1/search",
      {
        params: {
          name: city,
          count: 1,
          language: "RU",
          format: "json",
        },
      },
    );

    // Проверяем, нашелся ли город
    if (!geoRes.data.results || geoRes.data.results.length === 0) {
      throw new Error("Город не найден");
    }

    const location = geoRes.data.results[0];
    const { latitude, longitude, name, country } = location;

    // Шаг 2: Получаем текущую погоду по координатам
    const weatherRes = await axios.get(
      "https://api.open-meteo.com/v1/forecast",
      {
        params: {
          latitude: latitude,
          longitude: longitude,
          current_weather: true,
          hourly: "temperature_2m,relativehumidity_2m,windspeed_10m",
          daily: "weathercode",
          timezone: "auto",
          forecast_days: 1,
        },
      },
    );

    const current = weatherRes.data.current_weather;

    // Определяем иконку погоды на основе weathercode
    const weatherIcon = getWeatherIcon(current.weathercode);

    // Получаем дополнительную информацию (влажность) из hourly данных
    const humidity = weatherRes.data.hourly?.relativehumidity_2m?.[0] || "—";

    // Формируем красивый ответ
    const locationName = country ? `${name}, ${country}` : name;

    ctx.reply(`🌤️ Погода в городе ${locationName}:

${weatherIcon} ${getWeatherDescription(current.weathercode)}
🌡️ Температура: ${current.temperature}°C
💨 Ветер: ${current.windspeed} м/с
💧 Влажность: ${humidity}%

${getWeatherAdvice(current.temperature)}`);
  } catch (error) {
    console.error("Ошибка при получении погоды:", error.message);

    // Более информативное сообщение об ошибке
    if (error.message === "Город не найден") {
      ctx.reply(
        "❌ Не удалось найти этот город. Проверь правильность написания и попробуй снова.",
      );
    } else {
      ctx.reply(
        "🌧️ Не удалось получить погоду. Попробуй позже или проверь название города.",
      );
    }
  }

  // Удаляем пользователя из ожидания
  awaitingCity.delete(ctx.from.id);
});

// Функция для определения иконки погоды по коду
function getWeatherIcon(code) {
  // Weather codes from Open-Meteo: https://open-meteo.com/en/docs
  if (code === 0) return "☀️"; // Ясно
  if (code === 1) return "🌤️"; // Преимущественно ясно
  if (code === 2) return "⛅"; // Переменная облачность
  if (code === 3) return "☁️"; // Пасмурно
  if (code >= 45 && code <= 48) return "🌫️"; // Туман
  if (code >= 51 && code <= 55) return "🌧️"; // Морось
  if (code >= 56 && code <= 57) return "❄️🌧️"; // Ледяная морось
  if (code >= 61 && code <= 65) return "🌧️"; // Дождь
  if (code >= 66 && code <= 67) return "❄️🌧️"; // Ледяной дождь
  if (code >= 71 && code <= 75) return "❄️"; // Снег
  if (code === 77) return "❄️"; // Снежные зерна
  if (code >= 80 && code <= 82) return "🌧️"; // Ливень
  if (code >= 85 && code <= 86) return "❄️"; // Снегопад
  if (code >= 95 && code <= 99) return "⛈️"; // Гроза
  return "🌡️"; // По умолчанию
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
