import fs from 'fs/promises';
import path from 'path';

const months = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function formatHumanDate(isoString) {
  const date = new Date(isoString);
  const options = {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  };
  return date.toLocaleString('en-US', options); // или 'ru-RU' для русского
}

async function getDemonlist() {
  let list = [];

  try {
    const response = await fetch(
      'https://api.demonlist.org/levels/classic?search=&levels_type=all&user_id=20800&limit=0'
    );
    const json = await response.json();
    if (json.success && Array.isArray(json.data)) {
      list = json.data; // возвращаем массив data
    }
  } catch {
    throw new Error('Ошибка при получении данных с API Demonlist');
  }

  return {
    list,
  };
}

async function formatHistory() {
  try {
    const prevJsonPath = path.resolve('./history/HISTORY.prev.json');

    let prevUpdatedAt = null;

    // 1️⃣ Читаем предыдущий файл для получения updatedAt
    try {
      const prevData = await fs.readFile(prevJsonPath, 'utf-8');
      const prevHistory = JSON.parse(prevData);
      prevUpdatedAt = prevHistory.updatedAt;
    } catch {
      console.log('⚠️ Старого HISTORY.prev.json не найдено.');
    }

    if (prevUpdatedAt) {
      const prevDate = new Date(prevUpdatedAt);
      const currDate = new Date();
      // Проверяем, что номер дня месяца отличается (календарный день)
      if (
        currDate.getFullYear() === prevDate.getFullYear() &&
        currDate.getMonth() === prevDate.getMonth() &&
        currDate.getDate() === prevDate.getDate()
      ) {
        throw new Error(
          'С момента последнего обновления не сменился календарный день.'
        );
      }
    }

    // 2️⃣ Загружаем актуальный массив уровней с Demonlist API
    const history = await getDemonlist();

    // 3️⃣ Берём текущую дату в ISO формате (т.к. updatedAt нет в HISTORY.json)
    const currentISODate = new Date().toISOString();
    const currDate = new Date(currentISODate);

    // 4️⃣ Создаём резервную копию текущего файла, добавляя updatedAt с текущей датой
    const historyWithDate = {
      updatedAt: currentISODate,
      ...history,
    };
    await fs.writeFile(
      prevJsonPath,
      JSON.stringify(historyWithDate, null, 2),
      'utf-8'
    );
    console.log(
      '📦 Создан резервный HISTORY.prev.json с updatedAt для сравнения.'
    );

    // 5️⃣ Выводим сравнение updatedAt (prev vs current)
    if (prevUpdatedAt) {
      console.log(`🕒 Предыдущее обновление: ${prevUpdatedAt}`);
      console.log(`🆕 Новое обновление:      ${currentISODate}`);
    } else {
      console.log(`🆕 Текущее обновление: ${currentISODate}`);
    }

    // 6️⃣ Форматируем текущую дату для человека
    const humanDate = formatHumanDate(currentISODate);

    // 7️⃣ Генерация markdown с текущей датой
    let markdown = `# Demonlist History\n\n_Last updated: ${currentISODate} (${humanDate})_\n\n`;

    history.list.forEach((level) => {
      markdown += `## #${level.place}: ${level.name}\n\n`;
      markdown += `- **ID**: ${level.id}\n`;
      markdown += `- **Description**: ${
        level.description || '`There is no description`'
      }\n`;
      markdown += `- **Verifier**: ${level.verifier}\n`;
      markdown += `- **Holder**: ${level.holder}\n`;
      markdown += `- **Minimal Percent**: ${level.minimal_percent}%\n`;
      markdown += `- **Score**: ${level.score}\n\n`;
    });

    // 8️⃣ Определяем директорию для сохранения (как в generateDiff)
    const year = currDate.getFullYear().toString();
    const monthIndex = currDate.getMonth(); // 0-11
    const monthNumber = String(monthIndex + 1).padStart(2, '0');
    const monthName = months[monthIndex];
    const day = String(currDate.getDate()).padStart(2, '0');

    const targetDir = path.resolve(
      `./history/${year}/${monthNumber}-${monthName}/${day}`
    );
    await fs.mkdir(targetDir, { recursive: true });

    const mdPath = path.join(targetDir, 'HISTORY.md');

    // 9️⃣ Сохраняем HISTORY.md
    await fs.writeFile(mdPath, markdown, 'utf-8');

    console.log('✅ HISTORY.md успешно создан!');
    console.log(`ℹ️  Обработано уровней: ${history.list.length}`);
    console.log(`📄 Файл сохранён по пути: ${mdPath}`);
  } catch (error) {
    throw new Error(
      `❌ CRITICAL ERROR: Ошибка при генерации HISTORY.md ${error}`,
      error
    );
  }
}

async function generateDiff() {
  try {
    const prevJsonPath = path.resolve('./history/HISTORY.prev.json');

    let prevData = null;
    let prevDateISO = null;
    let prevDate = null;

    try {
      const rawPrev = await fs.readFile(prevJsonPath, 'utf-8');
      prevData = JSON.parse(rawPrev);
      prevDateISO = prevData.updatedAt;
      prevDate = new Date(prevDateISO);
    } catch (error) {
      console.warn(
        `⚠️ Не удалось прочитать или распарсить prev JSON: ${error.message}`
      );
    }

    if (prevData?.updatedAt) {
      const prevDate = new Date(prevData.updatedAt);
      const currDate = new Date();
      // Проверяем, что номер дня месяца отличается (календарный день)
      if (
        currDate.getFullYear() === prevDate.getFullYear() &&
        currDate.getMonth() === prevDate.getMonth() &&
        currDate.getDate() === prevDate.getDate()
      ) {
        throw new Error(
          'С момента последнего обновления не сменился календарный день.'
        );
      }
    }

    const currData = await getDemonlist();
    const currDate = new Date(); // now
    const currDateISO = currDate.toISOString();

    const prevLevels = prevData?.list ?? [];
    const currLevels = currData?.list ?? [];

    const prevHumanDate = prevDate ? formatHumanDate(prevDate) : '—';
    const currHumanDate = formatHumanDate(currDate);

    let markdown = `# Demonlist Changes\n\n`;
    markdown += `_Compared:_<br />\n`;
    markdown += `\`${prevDateISO ?? 'N/A'}\` → \`${currDateISO}\`<br />\n`;
    markdown += `**${prevHumanDate}** → **${currHumanDate}**\n\n`;

    let hasChanges = false;

    // Новые уровни
    const added = currLevels.filter(
      (curr) => !prevLevels.some((p) => p.id === curr.id)
    );

    if (added.length > 0) {
      hasChanges = true;
      markdown += `## 🆕 Added Levels\n\n`;
      added.forEach((level) => {
        markdown += `- **#${level.place}: ${level.name}** (ID: ${level.level_id})\n`;
      });
      markdown += '\n';
    }

    // Удалённые уровни
    const removed = prevLevels.filter(
      (prev) => !currLevels.some((c) => c.id === prev.id)
    );

    if (removed.length > 0) {
      hasChanges = true;
      markdown += `## ❌ Removed Levels\n\n`;
      removed.forEach((level) => {
        markdown += `- **#${level.place}: ${level.name}** (ID: ${level.level_id})\n`;
      });
      markdown += '\n';
    }

    markdown += `# ⚙️ Changes\n\n`;

    // Сравнение общих уровней по id
    currLevels.forEach((curr) => {
      const prev = prevLevels.find((p) => p.id === curr.id);
      if (prev) {
        const changes = [];

        const isMainTopPlaceChanged =
          prev.place <= 50 && Math.abs(curr.place - prev.place) > 1;
        const isBasicTopPlaceChanged =
          prev.place > 50 &&
          prev.place <= 100 &&
          Math.abs(curr.place - prev.place) > 2;
        const isExtendedTopPlaceChanged =
          prev.place > 100 &&
          prev.place <= 150 &&
          Math.abs(curr.place - prev.place) > 5;
        const isBeyondTopPlaceChanged =
          prev.place > 150 && Math.abs(curr.place - prev.place) > 20;
        const isTop50PlaceChanged =
          prev.place <= 50 && prev.place !== curr.place;
        const isPlaceChanged =
          isMainTopPlaceChanged ||
          isBasicTopPlaceChanged ||
          isTop50PlaceChanged ||
          isExtendedTopPlaceChanged ||
          isBeyondTopPlaceChanged;

        if (isPlaceChanged) {
          changes.push(`- **Place**: ${prev.place} → ${curr.place}`);
        }

        if (curr.score !== prev.score && isPlaceChanged) {
          changes.push(`- **Score**: ${prev.score} → ${curr.score}`);
        }

        if (curr.verifier !== prev.verifier) {
          changes.push(`- **Verifier**: ${prev.verifier} → ${curr.verifier}`);
        }

        if (curr.holder !== prev.holder) {
          changes.push(`- **Holder**: ${prev.holder} → ${curr.holder}`);
        }

        if (curr.minimal_percent !== prev.minimal_percent) {
          changes.push(
            `- **Minimal Percent**: ${prev.minimal_percent}% → ${curr.minimal_percent}%`
          );
        }

        if (changes.length > 0) {
          hasChanges = true;
          markdown += `## #${curr.place}: ${curr.name}\n\n`;
          markdown += changes.join('\n') + '\n\n';
        }
      }
    });

    // Если изменений нет, добавим сообщение
    if (!hasChanges) {
      markdown += `\n_Нет изменений между этими датами._\n`;
    }

    // Формируем путь для сохранения по дате
    const year = currDate.getFullYear().toString();
    const monthIndex = currDate.getMonth(); // 0-11
    const monthNumber = String(monthIndex + 1).padStart(2, '0');
    const monthName = months[monthIndex];
    const day = String(currDate.getDate()).padStart(2, '0');

    // Путь с информативным названием месяца
    const diffDir = path.resolve(
      `./history/${year}/${monthNumber}-${monthName}/${day}`
    );

    await fs.mkdir(diffDir, { recursive: true });

    const diffMdPath = path.join(diffDir, 'HISTORY.diff.md');

    // Записываем файл
    await fs.writeFile(diffMdPath, markdown, 'utf-8');

    console.log(`✅ HISTORY.diff.md успешно создан!`);
    console.log(`📄 Файл сохранён по пути: ${diffMdPath}`);
  } catch (error) {
    throw new Error(
      `❌ CRITICAL ERROR: Ошибка при создании HISTORY.diff.md ${error}`,
      error
    );
  }
}

generateDiff();
formatHistory();
