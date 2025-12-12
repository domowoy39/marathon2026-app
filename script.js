const tg = window.Telegram.WebApp;

// Инициализация
tg.expand();

// Кнопка "ЗАКРЫТЬ" внизу экрана
tg.MainButton.setText("ЗАКРЫТЬ");
tg.MainButton.show();

tg.MainButton.onClick(() => {
    tg.close();
});

// --- КОНФИГУРАЦИЯ ЦЕЛЕЙ ---

const GOALS_DEC_2025 = [1000, 2000, 5000];

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

// --- СОСТОЯНИЕ ---
let state = {
    monthIndex: 0,
    year: 0,
    level: null,
    gridData: [],
    completed: []
};

let storageKey = "";

// --- ЛОГИКА ---

function getCurrentGoals() {
    if (state.year === 2025 && state.monthIndex === 11) {
        return GOALS_DEC_2025;
    }
    if (state.year === 2026) {
        return GOALS_MATRIX_2026[state.monthIndex];
    }
    return [1000, 2000, 5000];
}

function init() {
    const date = new Date();
    state.monthIndex = date.getMonth();
    state.year = date.getFullYear();

    storageKey = `fin_marathon_${state.year}_${state.monthIndex}`;

    tg.CloudStorage.getItem(storageKey, (err, value) => {
        const loader = document.getElementById('loader');
        
        if (!err && value) {
            const parsed = JSON.parse(value);
            state.level = parsed.level;
            state.gridData = parsed.gridData;
            state.completed = parsed.completed;
            loader.classList.add('hidden');
            renderMainApp();
        } else {
            loader.classList.add('hidden');
            renderSelectionScreen();
        }
    });
}

function renderSelectionScreen() {
    const screen = document.getElementById('selection-screen');
    const goals = getCurrentGoals();
    
    // Скрываем нижнюю кнопку на экране выбора
    tg.MainButton.hide();

    document.getElementById('month-title').innerText = `План на ${MONTH_NAMES[state.monthIndex]}`;
    document.getElementById('amount-0').innerText = formatMoney(goals[0]) + ' ₽';
    document.getElementById('amount-1').innerText = formatMoney(goals[1]) + ' ₽';
    document.getElementById('amount-2').innerText = formatMoney(goals[2]) + ' ₽';
    
    screen.classList.remove('hidden');
}

function generateRandomParts(total, days) {
    let parts = [];
    let currentSum = 0;
    const avg = total / days;
    
    for (let i = 0; i < days - 1; i++) {
        let randomFactor = 0.7 + Math.random() * 0.6; 
        let val = Math.round(avg * randomFactor);
        val = Math.ceil(val / 10) * 10;
        if (val < 10) val = 10;
        parts.push(val);
        currentSum += val;
    }
    
    let remainder = total - currentSum;
    if (remainder <= 0) {
        return generateEvenParts(total, days);
    }
    
    parts.push(remainder);
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
    
    const goals = getCurrentGoals();
    const totalGoal = goals[level];
    const daysInMonth = new Date(state.year, state.monthIndex + 1, 0).getDate();
    
    const gridData = generateRandomParts(totalGoal, daysInMonth);
    const completed = new Array(daysInMonth).fill(false);
    
    state.level = level;
    state.gridData = gridData;
    state.completed = completed;
    
    saveState();
    
    document.getElementById('selection-screen').classList.add('hidden');
    renderMainApp();
}

function renderMainApp() {
    const app = document.getElementById('main-app');
    app.classList.remove('hidden');

    // Показываем кнопку "ЗАКРЫТЬ"
    tg.MainButton.show();
    
    // --- НОВОЕ: Вставляем название месяца и год в заголовок ---
    document.getElementById('main-month-title').innerText = `${MONTH_NAMES[state.monthIndex]} ${state.year}`;
    
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
    
    const today = new Date().getDate();
    
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
    tg.HapticFeedback.selectionChanged();
    state.completed[index] = !state.completed[index];
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

function formatMoney(num) {
    return new Intl.NumberFormat('ru-RU').format(num);
}

init();
