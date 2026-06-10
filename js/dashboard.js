let db = new Dexie("CalorieTrackerDB");
db.version(1).stores({ diary: "date" });
db.version(2).stores({ diary: "date", settings: "key" });

let dailyNorm        = 2100;
let dailyProteinNorm = 0;
let dailyFatNorm     = 0;
let dailyCarbsNorm   = 0;

function loadNormSettings() {
    return db.settings.get("norm")
        .then(function(n) {
            if (n) {
                dailyNorm        = n.norm;
                dailyProteinNorm = n.protein || 0;
                dailyFatNorm     = n.fat     || 0;
                dailyCarbsNorm   = n.carbs   || 0;

                setText("norm-title",     "Ваша норма: " + dailyNorm + " ккал/день");
                setText("norm-sub",       "Цель: " + (n.goalLabel || "поддержание веса") + " · Коэфф. активности: " + (n.factor || "-"));
                setText("norm-title-bar", dailyNorm);
                updateMacroNorms();
            } else {
                let ls = localStorage.getItem("dailyNorm");
                if (ls) { dailyNorm = Number(ls); setText("norm-title-bar", dailyNorm); }
            }
            updateTotals();
        })
        .catch(function() { updateTotals(); });
}

function updateMacroNorms() {
    let pairs = [
        { valId: "total-protein", normId: "norm-protein", norm: dailyProteinNorm },
        { valId: "total-fat",     normId: "norm-fat",     norm: dailyFatNorm     },
        { valId: "total-carbs",   normId: "norm-carbs",   norm: dailyCarbsNorm   }
    ];
    pairs.forEach(function(p) {
        if (p.norm <= 0) return;
        let existing = document.getElementById(p.normId);
        if (existing) {
            existing.textContent = " / " + p.norm + " г";
        } else {
            let valEl = document.getElementById(p.valId);
            if (!valEl) return;
            let span = document.createElement("span");
            span.id = p.normId;
            span.style.cssText = "color:#aaa; font-weight:400";
            span.textContent = " / " + p.norm + " г";
            valEl.closest(".macro-item").appendChild(span);
        }
    });
}

function getTodayDate() {
    let d = new Date();
    return d.getFullYear() + "-"
        + String(d.getMonth() + 1).padStart(2, "0") + "-"
        + String(d.getDate()).padStart(2, "0");
}

function formatDateRu(dateStr) {
    let parts = dateStr.split("-");
    let d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    let weekdays = ["Воскресенье","Понедельник","Вторник","Среда","Четверг","Пятница","Суббота"];
    let months   = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
    return weekdays[d.getDay()] + ", " + d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear();
}

let diary = { breakfast: [], lunch: [], dinner: [], snack: [] };

function saveDiary() {
    let cal = 0, prot = 0, fat = 0, carbs = 0;
    ["breakfast", "lunch", "dinner", "snack"].forEach(function(meal) {
        diary[meal].forEach(function(e) {
            cal   += e.calories;
            prot  += e.protein;
            fat   += e.fat;
            carbs += e.carbohydrates;
        });
    });

    let normReached = (dailyNorm > 0) && (cal >= dailyNorm * 0.95);

    db.diary.put({
        date:          getTodayDate(),
        breakfast:     diary.breakfast,
        lunch:         diary.lunch,
        dinner:        diary.dinner,
        snack:         diary.snack,
        totalCalories: Math.round(cal),
        totalProtein:  Math.round(prot  * 10) / 10,
        totalFat:      Math.round(fat   * 10) / 10,
        totalCarbs:    Math.round(carbs * 10) / 10,
        normCalories:  dailyNorm,
        normReached:   normReached
    }).catch(function(e) { console.log("Ошибка сохранения:", e); });
}

function loadDiary() {
    return db.diary.get(getTodayDate())
        .then(function(record) {
            if (record) {
                diary.breakfast = record.breakfast;
                diary.lunch     = record.lunch;
                diary.dinner    = record.dinner;
                diary.snack     = record.snack;
                renderDiary();
            }
        })
        .catch(function(e) { console.log("Ошибка загрузки:", e); });
}

function setText(id, text) {
    let el = document.getElementById(id);
    if (el) el.textContent = text;
}

function openEditModal(mealKey, index) {
    let entry = diary[mealKey][index];
    if (!entry) return;

    let existing = document.getElementById("edit-modal-overlay");
    if (existing) existing.remove();

    let overlay = document.createElement("div");
    overlay.className = "edit-modal-overlay";
    overlay.id = "edit-modal-overlay";

    overlay.innerHTML =
        "<div class='edit-modal'>" +
            "<div class='edit-modal-title'>" + entry.name + "</div>" +
            "<div class='edit-modal-sub'>Изменить количество граммов</div>" +
            "<div class='form-group' style='margin-bottom:12px'>" +
                "<label class='form-label'>Граммы</label>" +
                "<input class='form-input' id='edit-grams-input' type='number' min='1' value='" + entry.grams + "'>" +
            "</div>" +
            "<div class='edit-modal-preview' id='edit-preview'>" +
                "Калории: " + entry.calories + " ккал<br>" +
                "Белки: " + entry.protein + " г &nbsp;·&nbsp; Жиры: " + entry.fat + " г &nbsp;·&nbsp; Углеводы: " + entry.carbohydrates + " г" +
            "</div>" +
            "<div class='edit-modal-actions'>" +
                "<button class='btn-cancel' id='edit-cancel-btn'>Отмена</button>" +
                "<button class='btn-green'  id='edit-save-btn'>Сохранить</button>" +
            "</div>" +
        "</div>";

    document.body.appendChild(overlay);

    let gramsInput = document.getElementById("edit-grams-input");
    let preview    = document.getElementById("edit-preview");

    let per100 = {
        calories:      Math.round((entry.calories      / entry.grams) * 100 * 10) / 10,
        protein:       Math.round((entry.protein       / entry.grams) * 100 * 10) / 10,
        fat:           Math.round((entry.fat           / entry.grams) * 100 * 10) / 10,
        carbohydrates: Math.round((entry.carbohydrates / entry.grams) * 100 * 10) / 10
    };

    gramsInput.addEventListener("input", function() {
        let g = Number(gramsInput.value);
        if (g <= 0) return;
        let c = Math.round(per100.calories      / 100 * g);
        let p = Math.round(per100.protein       / 100 * g * 10) / 10;
        let f = Math.round(per100.fat           / 100 * g * 10) / 10;
        let u = Math.round(per100.carbohydrates / 100 * g * 10) / 10;
        preview.innerHTML = "Калории: " + c + " ккал<br>Белки: " + p + " г &nbsp;·&nbsp; Жиры: " + f + " г &nbsp;·&nbsp; Углеводы: " + u + " г";
    });

    document.getElementById("edit-save-btn").addEventListener("click", function() {
        let g = Number(gramsInput.value);
        if (g <= 0) { gramsInput.focus(); return; }

        diary[mealKey][index] = {
            name:          entry.name,
            grams:         g,
            calories:      Math.round(per100.calories      / 100 * g),
            protein:       Math.round(per100.protein       / 100 * g * 10) / 10,
            fat:           Math.round(per100.fat           / 100 * g * 10) / 10,
            carbohydrates: Math.round(per100.carbohydrates / 100 * g * 10) / 10
        };

        renderDiary();
        updateTotals();
        saveDiary();
        overlay.remove();
    });

    document.getElementById("edit-cancel-btn").addEventListener("click", function() { overlay.remove(); });
    overlay.addEventListener("click", function(e) { if (e.target === overlay) overlay.remove(); });

    gramsInput.focus();
    gramsInput.select();
}

let selectedFoodName        = "";
let selectedNutritionPer100 = null;
let foundFoods              = [];
let russianQuery            = "";

let openModalBtn  = document.getElementById("open-modal-btn");
let modalOverlay  = document.getElementById("modal-overlay");
let modalCloseBtn = document.getElementById("modal-close-btn");

openModalBtn.addEventListener("click", function(e) {
    e.preventDefault();
    modalOverlay.style.display = "flex";
    showStep("search");
    document.getElementById("food-search-input").value = "";
    document.getElementById("search-error").style.display = "none";
    document.getElementById("search-status").style.display = "none";
});

modalCloseBtn.addEventListener("click", function() { modalOverlay.style.display = "none"; });

modalOverlay.addEventListener("click", function(e) {
    if (e.target === modalOverlay) modalOverlay.style.display = "none";
});

function showStep(stepName) {
    ["step-search", "step-results", "step-weight"].forEach(function(id) {
        document.getElementById(id).style.display = "none";
    });
    document.getElementById("step-" + stepName).style.display = "block";
}

function showError(message) {
    let el = document.getElementById("search-error");
    el.textContent = message;
    el.style.display = "block";
}

let searchBtn = document.getElementById("search-btn");

searchBtn.addEventListener("click", function() {
    let query = document.getElementById("food-search-input").value.trim();
    if (!query) { showError("Введите название продукта"); return; }

    russianQuery = query;
    document.getElementById("search-error").style.display = "none";
    document.getElementById("search-status").style.display = "block";
    document.getElementById("search-status").textContent = "Ищем продукт...";
    searchBtn.disabled = true;

    searchFood(query)
        .then(function(foods) {
            searchBtn.disabled = false;
            document.getElementById("search-status").style.display = "none";
            foundFoods = foods;
            showResults(foods);
        })
        .catch(function(error) {
            searchBtn.disabled = false;
            document.getElementById("search-status").style.display = "none";
            showError(error.message);
        });
});

function showResults(foods) {
    let list = document.getElementById("search-results-list");
    list.innerHTML = "";
    foods.forEach(function(food) {
        let item = document.createElement("div");
        item.className = "result-item";
        item.innerHTML = "<div class='result-name'>" + food.food_name + "</div>"
                       + "<div class='result-info'>" + food.food_description + "</div>";
        item.addEventListener("click", function() { loadFoodDetails(food.food_id); });
        list.appendChild(item);
    });
    showStep("results");
}

function loadFoodDetails(foodId) {
    document.getElementById("search-status").style.display = "block";
    document.getElementById("search-status").textContent = "Загружаем данные...";
    showStep("search");

    getFoodDetails(foodId)
        .then(function(food) {
            document.getElementById("search-status").style.display = "none";
            selectedNutritionPer100 = getNutritionPer100(food);
            selectedFoodName = russianQuery;
            document.getElementById("selected-product-name").textContent = russianQuery;
            document.getElementById("food-weight-input").value = 100;
            updatePreview();
            showStep("weight");
        })
        .catch(function(error) {
            document.getElementById("search-status").style.display = "none";
            showError("Ошибка загрузки данных: " + error.message);
            showStep("search");
        });
}

document.getElementById("food-weight-input").addEventListener("input", updatePreview);

function updatePreview() {
    let grams = Number(document.getElementById("food-weight-input").value);
    if (grams <= 0 || !selectedNutritionPer100) return;
    let n = calcNutrition(selectedNutritionPer100, grams);
    setText("preview-calories", n.calories);
    setText("preview-protein",  n.protein);
    setText("preview-fat",      n.fat);
    setText("preview-carbs",    n.carbohydrates);
}

document.getElementById("back-to-search-btn").addEventListener("click",  function() { showStep("search");  });
document.getElementById("back-to-results-btn").addEventListener("click", function() { showStep("results"); });

document.getElementById("add-food-btn").addEventListener("click", function() {
    let grams = Number(document.getElementById("food-weight-input").value);
    let meal  = document.getElementById("meal-select").value;

    if (grams <= 0) { alert("Введите корректное количество граммов"); return; }
    if (!selectedNutritionPer100) return;

    let n = calcNutrition(selectedNutritionPer100, grams);
    diary[meal].push({ name: selectedFoodName, grams: grams, calories: n.calories, protein: n.protein, fat: n.fat, carbohydrates: n.carbohydrates });

    renderDiary();
    updateTotals();
    saveDiary();
    modalOverlay.style.display = "none";
});

function renderDiary() {
    renderMeal("breakfast", "breakfast-list", "breakfast-kcal");
    renderMeal("lunch",     "lunch-list",     "lunch-kcal");
    renderMeal("dinner",    "dinner-list",    "dinner-kcal");
    renderMeal("snack",     "snack-list",     "snack-kcal");
}

function renderMeal(mealKey, listId, kcalId) {
    let list    = document.getElementById(listId);
    let kcalEl  = document.getElementById(kcalId);
    let entries = diary[mealKey];
    list.innerHTML = "";
    let mealTotal = 0;

    entries.forEach(function(entry, i) {
        mealTotal += entry.calories;
        let row = document.createElement("div");
        row.className = "food-row";
        row.innerHTML =
            "<span class='food-emoji'>🍽</span>"
            + "<div class='food-info'>"
                + "<div class='food-name'>" + entry.name + " (" + entry.grams + " г)</div>"
                + "<div class='food-kcal-small'>" + entry.calories + " ккал · Б: " + entry.protein + "г · Ж: " + entry.fat + "г · У: " + entry.carbohydrates + "г</div>"
            + "</div>"
            + "<div class='food-actions'>"
                + "<button class='food-edit'  title='Изменить вес' data-meal='" + mealKey + "' data-index='" + i + "'>✏️</button>"
                + "<button class='food-delete' title='Удалить'      data-meal='" + mealKey + "' data-index='" + i + "'>✕</button>"
            + "</div>";
        list.appendChild(row);
    });

    kcalEl.textContent = mealTotal + " ккал";

    list.querySelectorAll(".food-edit").forEach(function(btn) {
        btn.addEventListener("click", function(e) {
            e.stopPropagation();
            openEditModal(this.dataset.meal, Number(this.dataset.index));
        });
    });

    list.querySelectorAll(".food-delete").forEach(function(btn) {
        btn.addEventListener("click", function() {
            diary[this.dataset.meal].splice(Number(this.dataset.index), 1);
            renderDiary();
            updateTotals();
            saveDiary();
        });
    });
}

function updateTotals() {
    let cal = 0, prot = 0, fat = 0, carbs = 0;

    ["breakfast", "lunch", "dinner", "snack"].forEach(function(meal) {
        diary[meal].forEach(function(e) {
            cal   += e.calories;
            prot  += e.protein;
            fat   += e.fat;
            carbs += e.carbohydrates;
        });
    });

    let percent   = Math.min(100, Math.round(cal / dailyNorm * 100));
    let remaining = dailyNorm - cal;

    setText("total-calories", cal);
    setText("total-protein",  Math.round(prot  * 10) / 10 + " г");
    setText("total-fat",      Math.round(fat   * 10) / 10 + " г");
    setText("total-carbs",    Math.round(carbs * 10) / 10 + " г");

    document.getElementById("calories-progress").style.width = percent + "%";
    setText("progress-label", percent + "% от нормы");

    let remEl = document.getElementById("cal-remaining-block");
    if (cal === 0)            { remEl.style.color = "#888";     remEl.textContent = "Осталось: " + dailyNorm + " ккал"; }
    else if (remaining > 0)   { remEl.style.color = "#2E7D52"; remEl.textContent = "Осталось: " + remaining + " ккал"; }
    else if (remaining === 0) { remEl.style.color = "#2E7D52"; remEl.textContent = "✓ Норма выполнена!"; }
    else                      { remEl.style.color = "#E53935"; remEl.textContent = "Превышение: +" + Math.abs(remaining) + " ккал"; }
}

loadDiary().then(function() {
    loadNormSettings();
    setText("diary-date", formatDateRu(getTodayDate()));
    loadStats();
});

function addDays(dateStr, n) {
    let parts = dateStr.split("-");
    let d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    d.setDate(d.getDate() + n);
    return d.getFullYear() + "-"
        + String(d.getMonth() + 1).padStart(2, "0") + "-"
        + String(d.getDate()).padStart(2, "0");
}

function loadStats() {
    let today = getTodayDate();
    let from  = addDays(today, -6);

    db.diary.where("date").between(from, today, true, true).toArray()
        .then(function(records) {
            renderWeekChart(records, from, today);
            renderStreakAndSummary(records, today);
            renderTopFoods(records);
        })
        .catch(function() {});
}

function renderWeekChart(records, from, today) {
    let chartEl = document.getElementById("week-chart");
    let daysEl  = document.getElementById("week-days");
    if (!chartEl || !daysEl) return;

    let byDate = {};
    records.forEach(function(r) { byDate[r.date] = r.totalCalories || 0; });

    let days = [];
    for (let i = 0; i < 7; i++) {
        days.push(addDays(from, i));
    }

    let maxCal = 0;
    days.forEach(function(d) { if ((byDate[d] || 0) > maxCal) maxCal = byDate[d] || 0; });
    if (dailyNorm > maxCal) maxCal = dailyNorm;
    if (maxCal === 0) maxCal = 2000;

    let WEEKDAYS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    let CHART_H = 100;

    chartEl.innerHTML = "";
    daysEl.innerHTML  = "";

    days.forEach(function(dateStr) {
        let cal     = byDate[dateStr] || 0;
        let isToday = dateStr === today;
        let height  = cal > 0 ? Math.max(4, Math.round((cal / maxCal) * CHART_H)) : 0;
        let overNorm = dailyNorm > 0 && cal > dailyNorm;

        let col = document.createElement("div");
        col.className = "week-col";

        let valEl = document.createElement("span");
        valEl.className = "week-val";
        valEl.textContent = cal > 0 ? cal : "";

        let barEl = document.createElement("div");
        barEl.className = "week-bar" + (isToday ? " today" : "");
        barEl.style.height = height + "px";
        if (overNorm) barEl.style.background = "#E53935";

        col.appendChild(valEl);
        col.appendChild(barEl);
        chartEl.appendChild(col);

        let parts = dateStr.split("-");
        let d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        let dayLabel = document.createElement("span");
        dayLabel.textContent = WEEKDAYS[d.getDay()];
        if (isToday) dayLabel.style.fontWeight = "700";
        daysEl.appendChild(dayLabel);
    });
}

function renderStreakAndSummary(records, today) {
    let byDate = {};
    records.forEach(function(r) { byDate[r.date] = r; });

    let totalCal = 0, normDays = 0, activeDays = 0;
    records.forEach(function(r) {
        if ((r.totalCalories || 0) > 0) {
            totalCal += r.totalCalories;
            activeDays++;
        }
        if (r.normReached) normDays++;
    });

    let avgCal = activeDays > 0 ? Math.round(totalCal / activeDays) : 0;

    setText("stat-avg-cal",   avgCal > 0 ? avgCal + " ккал/день" : "—");
    setText("stat-norm-days", activeDays > 0 ? normDays + " из " + activeDays + " дней ✓" : "—");

    let deficit = activeDays > 0 && dailyNorm > 0
        ? Math.round(totalCal - dailyNorm * activeDays)
        : 0;
    let defEl = document.getElementById("stat-deficit");
    if (defEl && activeDays > 0) {
        if (deficit < 0) {
            defEl.textContent = "Дефицит недели: " + deficit + " ккал";
        } else if (deficit > 0) {
            defEl.textContent = "Превышение: +" + deficit + " ккал";
            defEl.style.color = "#FFA726";
        }
    }

    let streak = 0;
    let cursor = today;
    while (true) {
        let rec = byDate[cursor];
        if (rec && (rec.totalCalories || 0) > 0) {
            streak++;
            cursor = addDays(cursor, -1);
        } else {
            break;
        }
    }

    let streakEl    = document.getElementById("stat-streak");
    let streakSubEl = document.getElementById("stat-streak-sub");
    if (streakEl) {
        let label = streak === 1 ? "день" : streak >= 2 && streak <= 4 ? "дня" : "дней";
        streakEl.textContent = streak + " " + label + " подряд";
    }
    if (streakSubEl) {
        if (streak === 0)       streakSubEl.textContent = "Начните вести дневник!";
        else if (streak < 3)    streakSubEl.textContent = "Хорошее начало!";
        else if (streak < 7)    streakSubEl.textContent = "Продолжайте в том же духе!";
        else if (streak < 14)   streakSubEl.textContent = "Отличный результат!";
        else                    streakSubEl.textContent = "Невероятный результат! 💪";
    }
}

function renderTopFoods(records) {
    let counts = {};
    records.forEach(function(r) {
        ["breakfast", "lunch", "dinner", "snack"].forEach(function(meal) {
            (r[meal] || []).forEach(function(e) {
                let name = e.name || "";
                if (!name) return;
                counts[name] = (counts[name] || 0) + 1;
            });
        });
    });

    let sorted = Object.keys(counts).sort(function(a, b) { return counts[b] - counts[a]; }).slice(0, 5);

    let list = document.getElementById("top-foods-list");
    if (!list) return;

    if (sorted.length === 0) {
        list.innerHTML = "<div style='font-size:12px; color:#aaa; padding:8px 0'>Добавьте продукты в дневник</div>";
        return;
    }

    let EMOJIS = ["🏆", "🥈", "🥉", "🏅", "📍"];
    list.innerHTML = sorted.map(function(name, i) {
        return "<div class='top-row'>"
            + "<span class='top-emoji'>" + EMOJIS[i] + "</span>"
            + "<span class='top-name'>" + name + "</span>"
            + "<span class='top-count'>" + counts[name] + " раз</span>"
            + "<span class='top-rank'>#" + (i + 1) + "</span>"
            + "</div>";
    }).join("");
}

(function seedTestData() {
    let btn = document.createElement("button");
    btn.textContent = "🧪 Тестовые данные";
    btn.style.cssText = "position:fixed;bottom:80px;right:16px;z-index:9999;"
        + "background:#1B3A2D;color:#fff;border:none;border-radius:8px;"
        + "padding:8px 14px;font-size:12px;cursor:pointer;opacity:0.85;";

    btn.addEventListener("click", function() {
        function offset(n) {
            let dt = new Date();
            dt.setDate(dt.getDate() + n);
            return dt.getFullYear() + "-"
                + String(dt.getMonth() + 1).padStart(2, "0") + "-"
                + String(dt.getDate()).padStart(2, "0");
        }

        function entry(name, grams, cal, prot, fat, carbs) {
            return { name: name, grams: grams, calories: cal, protein: prot, fat: fat, carbohydrates: carbs };
        }

        let days = [
            { date: offset(-6), cal: 3200, reached: true,
                breakfast: [entry("Овсянка", 200, 340, 12, 6, 58), entry("Яйцо", 100, 147, 13, 10, 1)],
                lunch:     [entry("Курица", 200, 237, 43, 5, 0), entry("Рис варёный", 150, 195, 4, 0, 44)],
                dinner:    [entry("Лосось с гречкой", 300, 420, 34, 14, 38)],
                snack:     [entry("Творог 5%", 150, 135, 18, 4, 3), entry("Нуты грецкие", 30, 186, 4, 18, 3)] },
            { date: offset(-5), cal: 10200, reached: false,
                breakfast: [entry("Панкейки с мёдом", 300, 840, 18, 30, 108), entry("Бекон", 200, 720, 38, 60, 0)],
                lunch:     [entry("Пицца пепперони", 600, 1620, 66, 72, 162), entry("Кола 0.5л", 500, 210, 0, 0, 53)],
                dinner:    [entry("Шаурма 500г", 500, 1850, 80, 140, 5), entry("Картофель фри", 300, 690, 9, 36, 90)],
                snack:     [entry("Торт шоколадный", 400, 1560, 20, 80, 196), entry("Мороженое", 200, 420, 6, 22, 52), entry("Чипсы", 150, 810, 7, 48, 90), entry("Сок", 300, 180, 2, 0, 44)] },
            { date: offset(-4), cal: 0, reached: false,
                breakfast: [], lunch: [], dinner: [], snack: [] },
            { date: offset(-3), cal: 3200, reached: false,
                breakfast: [entry("Каша гречневая", 200, 220, 8, 2, 44), entry("Творог 9%", 150, 202, 17, 9, 5)],
                lunch:     [entry("Суп куриный", 400, 180, 14, 6, 18), entry("Курица", 150, 178, 32, 4, 0)],
                dinner:    [entry("Лосось с овощами", 300, 360, 28, 12, 38)],
                snack:     [entry("Яблоко", 150, 78, 0, 0, 20), entry("Кефир 1%", 200, 68, 6, 1, 9)] },
            { date: offset(-2), cal: 3345, reached: true,
                breakfast: [entry("Овсянка", 200, 340, 12, 6, 58), entry("Яйцо", 100, 147, 13, 10, 1)],
                lunch:     [entry("Курица", 200, 237, 43, 5, 0), entry("Гречка", 150, 162, 6, 2, 32)],
                dinner:    [entry("Лосось запечённый", 200, 280, 40, 12, 0), entry("Овощи тушёные", 200, 120, 4, 4, 16)],
                snack:     [entry("Творог 5%", 150, 135, 18, 4, 3), entry("Миндаль", 30, 174, 4, 16, 6), entry("Кефир 1%", 250, 85, 9, 1, 12)] },
            { date: offset(-1), cal: 3538, reached: true,
                breakfast: [entry("Овсянка", 200, 340, 12, 6, 58), entry("Банан", 120, 107, 1, 0, 27)],
                lunch:     [entry("Курица", 200, 237, 43, 5, 0), entry("Гречка", 150, 162, 6, 2, 32)],
                dinner:    [entry("Рыба запечённая", 200, 280, 40, 12, 0), entry("Овощи тушёные", 200, 120, 4, 4, 16)],
                snack:     [entry("Творог 5%", 150, 135, 18, 4, 3), entry("Миндаль", 30, 174, 4, 16, 6)] },
            { date: offset(0),  cal: 950,  reached: false,
                breakfast: [entry("Овсянка", 200, 340, 12, 6, 58), entry("Яйцо", 100, 147, 13, 10, 1)],
                lunch:     [entry("Творог 9%", 150, 202, 17, 9, 5), entry("Банан", 120, 107, 1, 0, 27)],
                dinner:    [], snack: [] }
        ];

        let puts = days.map(function(day) {
            return db.diary.put({
                date:          day.date,
                breakfast:     day.breakfast,
                lunch:         day.lunch,
                dinner:        day.dinner,
                snack:         day.snack,
                totalCalories: day.cal,
                totalProtein:  0,
                totalFat:      0,
                totalCarbs:    0,
                normCalories:  dailyNorm,
                normReached:   day.reached
            });
        });

        Promise.all(puts).then(function() {
            btn.textContent = "✓ Записано";
            btn.style.background = "#2E7D52";
            setTimeout(function() { location.reload(); }, 600);
        });
    });

    document.body.appendChild(btn);
}());
