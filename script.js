const tg = window.Telegram.WebApp;

// Инициализация Telegram Mini App
tg.expand();
tg.enableClosingConfirmation();

// --- КОНФИГУРАЦИЯ ЦЕЛЕЙ ---

// 1. Цели специально для Декабря 2025
const GOALS_DEC_2025 = [1000, 2000, 5000];

// 2. Матрица целей на весь 2026 год (Январь - Декабрь)
const GOALS_MATRIX_2026 = [
    [2000, 4000, 10000],    // Январь
    [3000, 7000, 20000],    // Февраль
    [4000, 10000, 30000],   // Март
    [5000, 15000, 45000],   // Апрель
    [6000, 20000, 60000],   // Май
    [7000, 25000, 75000],   // Июнь
    [8000, 30000, 90000],   // Июль
    [9000, 35000, 105000],  // Август
    [10000, 40000, 120000], // Сентябрь
    [11000, 45000, 135000], // Октябрь
    [12000, 50000, 150000], // Ноябрь
    [14000, 60000, 175000]  // Декабрь
];

const MONTH_NAMES = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// --- СОСТОЯНИЕ ПРИЛОЖЕНИЯ ---
let state = {
    monthIndex: 0,
    year: 0,
    level: null,      // 0 (Лайт), 1 (Прогресс), 2 (Вызов)
    gridData: [],     // массив сумм на каждый день
    completed: []     // массив галочек (true/false)
};

let storageKey = "";

// --- ЛОГИКА ---

// Функция определяет, какие цели показывать в зависимости от даты
function getCurrentGoals() {
    // Если сейчас 2025 год и Декабрь (месяц 11 в JS, так как счет с 0)
    if (state.year === 2025 && state.monthIndex === 11) {
        return GOALS_DEC_2025;
    }
    
    // Если сейчас 2026 год - берем из матрицы
    if (state.year === 2026) {
        return GOALS_MATRIX_2026[state.monthIndex];
    }
    
    // Fallback (запасной вариант) на случай других дат - берем цели Декабря 2025
    return [1000, 2000, 5000];
}

function init() {
    const date = new Date();
    state.monthIndex = date.getMonth();
    state.year = date.getFullYear();

    // Уникальный ключ для сохранения (разный для каждого месяца и года)
    storageKey = `fin_marathon_${state.year}_${state.monthIndex}`;

    // Загрузка данных из облака Telegram
    tg.CloudStorage.getItem(storageKey, (err, value) => {
        const loader = document.getElementById('loader');
        
        if (!err && value) {
            // Данные есть - показываем сразу календарь
            const parsed = JSON.parse(value);
            state.level = parsed.level;
            state.gridData = parsed.gridData;
            state.completed = parsed.completed;
            loader.classList.add('hidden');
            renderMainApp();
        } else {
            // Данных нет - показываем экран выбора
            loader.classList.add('hidden');
            renderSelectionScreen();
        }
    });
}

function renderSelectionScreen() {
    const screen = document.getElementById('selection-screen');
    
    // Получаем правильные цели через новую функцию
    const goals = getCurrentGoals();
    
    document.getElementById('month-title').innerText = `План на ${MONTH_NAMES[state.monthIndex]}`;
    
    // Обновляем суммы в карточках
    document.getElementById('amount-0').innerText = formatMoney(goals[0]) + ' ₽';
    document.getElementById('amount-1').innerText = formatMoney(goals[1]) + ' ₽';
    document.getElementById('amount-2').innerText = formatMoney(goals[2]) + ' ₽';
    
    screen.classList.remove('hidden');
}

// Алгоритм разбиения суммы на случайные части
function generateRandomParts(total, days) {
    let parts = [];
    let currentSum = 0;
    
    // Среднее значение на день
    const avg = total / days;
    
    for (let i = 0; i < days - 1; i++) {
        // Рандомный разброс (от 70% до 130% от среднего)
        let randomFactor = 0.7 + Math.random() * 0.6; 
        let val = Math.round(avg * randomFactor);
        
        // Округляем до 10 рублей для красоты
        val = Math.ceil(val / 10) * 10;
        
        // Минимальный взнос 10р
        if (val < 10) val = 10;
        
        parts.push(val);
        currentSum += val;
    }
    
    // Последний день забирает остаток
    let remainder = total - currentSum;
    
    // Если рандом "перестарался" и остаток <= 0, делаем пересчет по-простому
    if (remainder <= 0) {
        return generateEvenParts(total, days);
    }
    
    parts.push(remainder);
    
    // Перемешиваем дни, чтобы суммы шли вразнобой
    return parts.sort(() => Math.random() - 0.5);
}

// Запасной генератор (ровными частями), если сложный сломается
function generateEvenParts(total, days) {
    let parts = [];
    let rem = total;
    for (let i = 0; i < days - 1; i++) {
        let val = Math.floor(rem / (days - i));
        parts.push(val);
        rem -= val;
    }
    parts.push(rem);
    return parts.sort(() => Math.random() - 0.5);
}

function selectLevel(level) {
    // Вибрация при нажатии
    tg.HapticFeedback.impactOccurred('medium');
    
    // Получаем цель на основе выбранного уровня (0, 1 или 2) и текущей даты
    const goals = getCurrentGoals();
    const totalGoal = goals[level];
    
    // Определяем количество дней в текущем месяце
    const daysInMonth = new Date(state.year, state.monthIndex + 1, 0).getDate();
    
    // Генерируем сетку
    const gridData = generateRandomParts(totalGoal, daysInMonth);
    const completed = new Array(daysInMonth).fill(false);
    
    // Сохраняем состояние в переменную
    state.level = level;
    state.gridData = gridData;
    state.completed = completed;
    
    // Сохраняем в облако
    saveState();
    
    // Переключаем экраны
    document.getElementById('selection-screen').classList.add('hidden');
    renderMainApp();
}

function renderMainApp() {
    const app = document.getElementById('main-app');
    app.classList.remove('hidden');
    
    // Обновляем заголовок уровня
    const levelsInfo = [
        { text: "Лайт", icon: "🟢" },
        { text: "Прогресс", icon: "🟡" },
        { text: "Вызов", icon: "🔴" }
    ];
    const info = levelsInfo[state.level];
    document.getElementById('current-level-display').innerText = `${info.icon} ${info.text}`;
    
    renderGrid();
    updateProgress();
}

function renderGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    const today = new Date().getDate(); // Текущее число (1-31)
    
    state.gridData.forEach((amount, index) => {
        const dayNum = index + 1;
        const isCompleted = state.completed[index];
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        
        if (isCompleted) cell.classList.add('checked');
        // Подсветка "Сегодня"
        if (dayNum === today) cell.classList.add('today');
        
        cell.innerHTML = `
            <div class="day-num">${dayNum}</div>
            <div class="amount">${amount}</div>
        `;
        
        cell.onclick = () => toggleDay(index);
        
        grid.appendChild(cell);
    });
}

function toggleDay(index) {
    tg.HapticFeedback.selectionChanged();
    
    state.completed[index] = !state.completed[index];
    
    // Перерисовываем сетку для обновления стилей
    renderGrid(); 
    updateProgress();
    saveState();
}

function updateProgress() {
    const total = state.gridData.reduce((a, b) => a + b, 0);
    let saved = 0;
    
    state.gridData.forEach((amount, i) => {
        if (state.completed[i]) saved += amount;
    });
    
    document.getElementById('saved-amount').innerText = formatMoney(saved);
    document.getElementById('goal-amount').innerText = formatMoney(total);
    
    const percent = (saved / total) * 100;
    document.getElementById('progress-bar').style.width = `${percent}%`;
    
    // Салют (вибрация успеха) при 100%
    if (saved === total && total > 0) {
        tg.HapticFeedback.notificationOccurred('success');
    }
}

function saveState() {
    const dataToSave = JSON.stringify({
        level: state.level,
        gridData: state.gridData,
        completed: state.completed
    });
    
    tg.CloudStorage.setItem(storageKey, dataToSave);
}

function resetProgress() {
    tg.showConfirm("Сбросить прогресс и выбрать новую цель?", (ok) => {
        if (ok) {
            tg.HapticFeedback.impactOccurred('heavy');
            tg.CloudStorage.removeItem(storageKey, (err) => {
                if (!err) location.reload();
            });
        }
    });
}

// Форматирование денег (пробелы между тысячами)
function formatMoney(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

// Запуск
init();
