import { Telegraf } from "telegraf";
import dotenv from "dotenv";
import axios from "axios";

const DEBUG = true;

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
// Обработчик текстовых сообщений (ввод города)
bot.on("text", async (ctx) => {
  if (!awaitingCity.has(ctx.from.id)) return;

  let city = ctx.message.text.trim();

  // Специальная обработка для известных российских городов
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

  // Проверяем, есть ли город в списке русских городов
  const cityLower = city.toLowerCase();
  let searchCity = city;
  let forceRussian = false;

  if (russianCitiesMap[cityLower]) {
    searchCity = russianCitiesMap[cityLower].name;
    forceRussian = true;
    if (DEBUG)
      console.log(
        `🔍 Русский город обнаружен: ${city} -> ищем ${searchCity} в России`,
      );
  }

  if (DEBUG) console.log(`Поиск города: "${searchCity}"`);

  try {
    let location = null;
    let geoRes = null;

    // Если это русский город из списка или если явно ищем в России
    if (forceRussian) {
      // Ищем ТОЛЬКО в России с английским названием
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
          console.log(
            `✅ Найден в России: ${location.name}, ${location.country}`,
          );
      }
    }

    // Если не нашли через forceRussian или не было forceRussian — ищем стандартным способом
    if (!location) {
      // Сначала ищем ТОЛЬКО в России
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

      if (DEBUG) {
        console.log(
          `Результатов в России: ${geoRes.data.results?.length || 0}`,
        );
        if (geoRes.data.results) {
          geoRes.data.results.forEach((loc, i) => {
            console.log(
              `  ${i + 1}. ${loc.name}, ${loc.country} (население: ${loc.population || "?"})`,
            );
          });
        }
      }

      // Если в России нашли — берем первый
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

      if (DEBUG && geoRes.data.results) {
        console.log(`Найдено везде: ${geoRes.data.results.length}`);
        geoRes.data.results.forEach((loc, i) => {
          console.log(
            `  ${i + 1}. ${loc.name}, ${loc.country} (${loc.country_code})`,
          );
        });
      }

      if (geoRes.data.results && geoRes.data.results.length > 0) {
        location = geoRes.data.results[0];

        // Если нашли Таджикистан для Москвы — подменяем на Россию
        if (cityLower === "москва" && location.country_code === "TJ") {
          if (DEBUG)
            console.log(`⚠️ Найден Таджикистан, ищем Москву в России...`);
          // Ищем Москву в России специально
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
            if (DEBUG)
              console.log(
                `✅ Подменено на: ${location.name}, ${location.country}`,
              );
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
      name: city, // Сохраняем оригинальное название, которое ввел пользователь
      country,
    });

    // Формируем сообщение
    let locationInfo = `${city}, ${country}`;

    // Если нашли Таджикистан для Москвы — предупреждаем
    if (cityLower === "москва" && country_code === "TJ") {
      locationInfo = `⚠️ Найден город: ${name}, ${country}\n\nВозможно, вы имели в виду Москву, Россия?\nЕсли да, попробуйте написать "Москва Россия"`;
    }

    ctx.reply(`📍 ${locationInfo}\n\nЧто хотите узнать?`, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌤️ Погода сейчас", callback_data: "weather_now" },
            { text: "📅 Прогноз на завтра", callback_data: "weather_tomorrow" },
          ],
        ],
      },
    });

    awaitingCity.delete(ctx.from.id);
  } catch (error) {
    console.error("Ошибка:", error.message);
    ctx.reply(
      "❌ Не удалось найти этот город.\n\n" +
        "Попробуйте:\n" +
        "• проверить написание\n" +
        "• добавить страну (например, 'Москва Россия')\n" +
        "• использовать английское название ('Moscow')",
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
