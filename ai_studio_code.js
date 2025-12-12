const tg = window.Telegram.WebApp;

// Инициализация Telegram Mini App
tg.expand();
tg.enableClosingConfirmation();

// --- КОНФИГУРАЦИЯ ---

// Массив сумм согласно заданию (Индексы 0-11 соответствуют Янв-Дек)
const GOALS_MATRIX = [
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

// --- СОСТОЯНИЕ ---
let state = {
    monthIndex: 0,
    year: 0,
    level: null,      // 0, 1, 2
    gridData: [],     // массив сумм на каждый день
    completed: []     // массив булевых значений (выполнено/нет)
};

let storageKey = "";

// --- ФУНКЦИИ ---

function init() {
    const date = new Date();
    // В продакшене можно использовать фиксированный 2026 год, если цель строго на 2026
    // Но для теста берем текущий месяц
    state.monthIndex = date.getMonth();
    state.year = date.getFullYear(); // В реальной задаче: 2026

    // Ключ уникален для каждого месяца и года
    storageKey = `fin_marathon_${state.year}_${state.monthIndex}`;

    // Загрузка данных из облака
    tg.CloudStorage.getItem(storageKey, (err, value) => {
        const loader = document.getElementById('loader');
        
        if (!err && value) {
            // Данные есть - показываем сетку
            const parsed = JSON.parse(value);
            state.level = parsed.level;
            state.gridData = parsed.gridData;
            state.completed = parsed.completed;
            loader.classList.add('hidden');
            renderMainApp();
        } else {
            // Данных нет - показываем выбор
            loader.classList.add('hidden');
            renderSelectionScreen();
        }
    });
}

function renderSelectionScreen() {
    const screen = document.getElementById('selection-screen');
    const goals = GOALS_MATRIX[state.monthIndex];
    
    document.getElementById('month-title').innerText = `План на ${MONTH_NAMES[state.monthIndex]}`;
    
    // Обновляем суммы в карточках
    document.getElementById('amount-0').innerText = formatMoney(goals[0]) + ' ₽';
    document.getElementById('amount-1').innerText = formatMoney(goals[1]) + ' ₽';
    document.getElementById('amount-2').innerText = formatMoney(goals[2]) + ' ₽';
    
    screen.classList.remove('hidden');
}

// Алгоритм разбиения суммы
function generateRandomParts(total, days) {
    let parts = [];
    let currentSum = 0;
    
    // Среднее значение на день
    const avg = total / days;
    
    for (let i = 0; i < days - 1; i++) {
        // Генерируем случайное число с разбросом +/- 30% от среднего
        let randomFactor = 0.7 + Math.random() * 0.6; 
        let val = Math.round(avg * randomFactor);
        
        // Округляем до красивых чисел (10)
        val = Math.ceil(val / 10) * 10;
        
        // Минимальный платеж 10р
        if (val < 10) val = 10;
        
        parts.push(val);
        currentSum += val;
    }
    
    // Последний день забирает остаток, чтобы сумма сошлась копейка в копейку
    let remainder = total - currentSum;
    
    // Если остаток получился отрицательным или слишком маленьким (из-за рандома), 
    // корректируем предыдущие дни
    if (remainder <= 0) {
        // Простой фикс: равномерное распределение, если рандом сломался
        // В реальном приложении можно использовать более сложный рекурсивный метод
        // Здесь для простоты вернем равномерное распределение
        return generateEvenParts(total, days);
    }
    
    parts.push(remainder);
    
    // Перемешиваем массив, чтобы большие суммы не скапливались в конце
    return parts.sort(() => Math.random() - 0.5);
}

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
    tg.HapticFeedback.impactOccurred('medium');
    
    const totalGoal = GOALS_MATRIX[state.monthIndex][level];
    
    // Определяем количество дней в текущем месяце
    const daysInMonth = new Date(state.year, state.monthIndex + 1, 0).getDate();
    
    // Генерируем сетку
    const gridData = generateRandomParts(totalGoal, daysInMonth);
    const completed = new Array(daysInMonth).fill(false);
    
    // Сохраняем состояние
    state.level = level;
    state.gridData = gridData;
    state.completed = completed;
    
    saveState();
    
    // Переход к интерфейсу
    document.getElementById('selection-screen').classList.add('hidden');
    renderMainApp();
}

function renderMainApp() {
    const app = document.getElementById('main-app');
    app.classList.remove('hidden');
    
    // Хедер
    const levelsInfo = [
        { text: "Лайт", icon: "🟢" },
        { text: "Прогресс", icon: "🟡" },
        { text: "Вызов", icon: "🔴" }
    ];
    const info = levelsInfo[state.level];
    document.getElementById('current-level-display').innerText = `${info.icon} ${info.text}`;
    
    // Отрисовка сетки
    renderGrid();
    updateProgress();
}

function renderGrid() {
    const grid = document.getElementById('grid');
    grid.innerHTML = '';
    
    const today = new Date().getDate(); // Число месяца (1-31)
    
    state.gridData.forEach((amount, index) => {
        const dayNum = index + 1;
        const isCompleted = state.completed[index];
        
        const cell = document.createElement('div');
        cell.className = 'day-cell';
        if (isCompleted) cell.classList.add('checked');
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
    // Вибрация
    tg.HapticFeedback.selectionChanged();
    
    // Логика переключения
    state.completed[index] = !state.completed[index];
    
    // Обновляем UI одной ячейки (оптимизация)
    const cells = document.querySelectorAll('.day-cell');
    const cell = cells[index];
    
    if (state.completed[index]) {
        cell.classList.add('checked');
    } else {
        cell.classList.remove('checked');
    }
    
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
    
    // Если 100% - салют (вибрация успеха)
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
    tg.showConfirm("Вы уверены, что хотите сбросить прогресс и выбрать новый уровень сложности?", (ok) => {
        if (ok) {
            tg.HapticFeedback.impactOccurred('heavy');
            // Очищаем хранилище
            tg.CloudStorage.removeItem(storageKey, (err) => {
                if (!err) location.reload();
            });
        }
    });
}

// Утилита форматирования денег (1 000)
function formatMoney(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

// Запуск
init();