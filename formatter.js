import fs from 'fs/promises';
import path from 'path';

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

async function formatHistory() {
  try {
    const jsonPath = path.resolve('./HISTORY.json');
    const prevJsonPath = path.resolve('./DATA/HISTORY.prev.json');
    const mdPath = path.resolve('./DATA/HISTORY.md');

    let prevUpdatedAt = null;

    // 1️⃣ Читаем предыдущий файл для получения updatedAt
    try {
      const prevData = await fs.readFile(prevJsonPath, 'utf-8');
      const prevHistory = JSON.parse(prevData);
      prevUpdatedAt = prevHistory.updatedAt;
    } catch {
      console.log('⚠️ Старого HISTORY.prev.json не найдено.');
    }

    // 2️⃣ Читаем текущий HISTORY.json (без updatedAt)
    const jsonData = await fs.readFile(jsonPath, 'utf-8');
    const history = JSON.parse(jsonData);

    // 3️⃣ Берём текущую дату в ISO формате (т.к. updatedAt нет в HISTORY.json)
    const currentISODate = new Date().toISOString();

    // 4️⃣ Создаём резервную копию текущего файла, добавляя updatedAt с текущей датой
    const historyWithDate = {
      ...history,
      updatedAt: currentISODate,
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
      markdown += `- **Description**: ${level.description}\n`;
      markdown += `- **Verifier**: ${level.verifier}\n`;
      markdown += `- **Holder**: ${level.holder}\n`;
      markdown += `- **Minimal Percent**: ${level.minimal_percent}%\n`;
      markdown += `- **Score**: ${level.score}\n\n`;
    });

    // 8️⃣ Сохраняем HISTORY.md
    await fs.writeFile(mdPath, markdown, 'utf-8');

    console.log('✅ HISTORY.md успешно создан!');
    console.log(`ℹ️  Обработано уровней: ${history.list.length}`);
    console.log(`📄 Файл сохранён по пути: ${mdPath}`);
  } catch (error) {
    console.error('❌ Ошибка при генерации HISTORY.md:', error);
  }
}

async function generateDiff() {
  try {
    const currJsonPath = path.resolve('./HISTORY.json');
    const prevJsonPath = path.resolve('./DATA/HISTORY.prev.json');

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

    const currDataRaw = await fs.readFile(currJsonPath, 'utf-8');
    const currData = JSON.parse(currDataRaw);
    const currDate = new Date(); // now
    const currDateISO = currDate.toISOString();

    const prevLevels = prevData?.list ?? [];
    const currLevels = currData?.list ?? [];

    const prevHumanDate = prevDate ? formatHumanDate(prevDate) : '—';
    const currHumanDate = formatHumanDate(currDate);

    let markdown = `# Demonlist Changes\n\n`;
    markdown += `_Compared: ${
      prevDateISO ?? 'N/A'
    } → ${currDateISO} (${prevHumanDate} → ${currHumanDate})_\n\n`;

    let hasChanges = false;

    // Сравнение общих уровней по id
    currLevels.forEach((curr) => {
      const prev = prevLevels.find((p) => p.id === curr.id);
      if (prev) {
        const changes = [];

        if (curr.place !== prev.place)
          changes.push(`- **Place**: ${prev.place} → ${curr.place}`);
        if (curr.verifier !== prev.verifier)
          changes.push(`- **Verifier**: ${prev.verifier} → ${curr.verifier}`);
        if (curr.holder !== prev.holder)
          changes.push(`- **Holder**: ${prev.holder} → ${curr.holder}`);
        if (curr.minimal_percent !== prev.minimal_percent)
          changes.push(
            `- **Minimal Percent**: ${prev.minimal_percent}% → ${curr.minimal_percent}%`
          );
        if (curr.score !== prev.score)
          changes.push(`- **Score**: ${prev.score} → ${curr.score}`);

        if (changes.length > 0) {
          hasChanges = true;
          markdown += `## #${curr.place}: ${curr.name}\n`;
          markdown += changes.join('\n') + '\n\n';
        }
      }
    });

    // Новые уровни
    const added = currLevels.filter(
      (curr) => !prevLevels.some((p) => p.id === curr.id)
    );
    if (added.length > 0) {
      hasChanges = true;
      markdown += `## 🆕 Added Levels\n\n`;
      added.forEach((level) => {
        markdown += `- **#${level.place}: ${level.name}** (ID: ${level.id})\n`;
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
        markdown += `- **#${level.place}: ${level.name}** (ID: ${level.id})\n`;
      });
      markdown += '\n';
    }

    // Если изменений нет, добавим сообщение
    if (!hasChanges) {
      markdown += `\n_Нет изменений между этими датами._\n`;
    }

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

    // Формируем путь для сохранения по дате
    const year = currDate.getFullYear().toString();
    const monthIndex = currDate.getMonth(); // 0-11
    const monthNumber = String(monthIndex + 1).padStart(2, '0');
    const monthName = months[monthIndex];
    const day = String(currDate.getDate()).padStart(2, '0');

    // Путь с информативным названием месяца
    const diffDir = path.resolve(
      `./DATA/diffs/${year}/${monthNumber}-${monthName}/${day}`
    );

    await fs.mkdir(diffDir, { recursive: true });

    const diffMdPath = path.join(diffDir, 'HISTORY.diff.md');

    // Записываем файл
    await fs.writeFile(diffMdPath, markdown, 'utf-8');

    console.log(`✅ HISTORY.diff.md успешно создан!`);
    console.log(`📄 Файл сохранён по пути: ${diffMdPath}`);
  } catch (error) {
    console.error('❌ Ошибка при создании HISTORY.diff.md:', error);
  }
}

generateDiff();
formatHistory();
