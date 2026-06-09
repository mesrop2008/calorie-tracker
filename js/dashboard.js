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
    db.diary.put({
        date: getTodayDate(),
        breakfast: diary.breakfast,
        lunch:     diary.lunch,
        dinner:    diary.dinner,
        snack:     diary.snack
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

let selectedFoodName       = "";
let selectedNutritionPer100 = null;
let foundFoods             = [];
let russianQuery           = "";

let openModalBtn = document.getElementById("open-modal-btn");
let modalOverlay = document.getElementById("modal-overlay");
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
            + "<button class='food-delete' data-meal='" + mealKey + "' data-index='" + i + "'>✕</button>";
        list.appendChild(row);
    });

    kcalEl.textContent = mealTotal + " ккал";

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
    if (cal === 0)      { remEl.style.color = "#888";     remEl.textContent = "Осталось: " + dailyNorm + " ккал"; }
    else if (remaining > 0) { remEl.style.color = "#2E7D52"; remEl.textContent = "Осталось: " + remaining + " ккал"; }
    else if (remaining === 0) { remEl.style.color = "#2E7D52"; remEl.textContent = "✓ Норма выполнена!"; }
    else                { remEl.style.color = "#E53935"; remEl.textContent = "Превышение: +" + Math.abs(remaining) + " ккал"; }
}


loadDiary().then(function() {
    loadNormSettings();
    setText("diary-date", formatDateRu(getTodayDate()));
});
