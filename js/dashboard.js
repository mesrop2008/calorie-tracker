
let db = new Dexie("CalorieTrackerDB");

db.version(1).stores({
    diary: "date"
});


function getTodayDate() {
    let today = new Date();
    let year = today.getFullYear();
    let month = String(today.getMonth() + 1).padStart(2, "0");
    let day = String(today.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
}

function saveDiary() {
    let todayDate = getTodayDate();

    let record = {
        date: todayDate,
        breakfast: diary.breakfast,
        lunch: diary.lunch,
        dinner: diary.dinner,
        snack: diary.snack
    };

    db.diary.put(record).catch(function (error) {
        console.log("Ошибка сохранения дневника:", error);
    });
}

function loadDiary() {
    let todayDate = getTodayDate();

    return db.diary.get(todayDate)
        .then(function (record) {
            if (record) {
                diary.breakfast = record.breakfast;
                diary.lunch = record.lunch;
                diary.dinner = record.dinner;
                diary.snack = record.snack;

                renderDiary();
                updateTotals();
            }
        })
        .catch(function (error) {
            console.log("Ошибка загрузки дневника:", error);
        });
}


let diary = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snack: []
};

let savedNorm = localStorage.getItem("dailyNorm");
let dailyNorm = 2100;

if (savedNorm !== null) {
    dailyNorm = Number(savedNorm);
}

let selectedFoodName = "";
let selectedNutritionPer100 = null;
let foundFoods = [];
let russianQuery = "";


let openModalBtn = document.getElementById("open-modal-btn");
let modalOverlay = document.getElementById("modal-overlay");
let modalCloseBtn = document.getElementById("modal-close-btn");

openModalBtn.addEventListener("click", function (event) {
    event.preventDefault();
    modalOverlay.style.display = "flex";
    showStep("search");
    document.getElementById("food-search-input").value = "";
    document.getElementById("search-error").style.display = "none";
    document.getElementById("search-status").style.display = "none";
});

modalCloseBtn.addEventListener("click", function () {
    modalOverlay.style.display = "none";
});

modalOverlay.addEventListener("click", function (event) {
    if (event.target === modalOverlay) {
        modalOverlay.style.display = "none";
    }
});


function showStep(stepName) {
    document.getElementById("step-search").style.display = "none";
    document.getElementById("step-results").style.display = "none";
    document.getElementById("step-weight").style.display = "none";

    if (stepName === "search") {
        document.getElementById("step-search").style.display = "block";
    } else if (stepName === "results") {
        document.getElementById("step-results").style.display = "block";
    } else if (stepName === "weight") {
        document.getElementById("step-weight").style.display = "block";
    }
}


let searchBtn = document.getElementById("search-btn");

searchBtn.addEventListener("click", function () {
    let query = document.getElementById("food-search-input").value.trim();

    if (query === "") {
        showError("Введите название продукта");
        return;
    }

    russianQuery = query;

    document.getElementById("search-error").style.display = "none";
    document.getElementById("search-status").style.display = "block";
    document.getElementById("search-status").textContent = "Ищем продукт...";
    searchBtn.disabled = true;

    searchFood(query)
        .then(function (foods) {
            searchBtn.disabled = false;
            document.getElementById("search-status").style.display = "none";
            foundFoods = foods;
            showResults(foods);
        })
        .catch(function (error) {
            searchBtn.disabled = false;
            document.getElementById("search-status").style.display = "none";
            showError(error.message);
        });
});

function showError(message) {
    let errorEl = document.getElementById("search-error");
    errorEl.textContent = message;
    errorEl.style.display = "block";
}


function showResults(foods) {
    let list = document.getElementById("search-results-list");
    list.innerHTML = "";

    for (let i = 0; i < foods.length; i++) {
        let food = foods[i];

        let item = document.createElement("div");
        item.className = "result-item";
        item.innerHTML =
            "<div class='result-name'>" + food.food_name + "</div>" +
            "<div class='result-info'>" + food.food_description + "</div>";

        item.addEventListener("click", function () {
            loadFoodDetails(food.food_id);
        });

        list.appendChild(item);
    }

    showStep("results");
}


function loadFoodDetails(foodId) {
    document.getElementById("search-status").style.display = "block";
    document.getElementById("search-status").textContent = "Загружаем данные...";
    showStep("search");

    getFoodDetails(foodId)
        .then(function (food) {
            document.getElementById("search-status").style.display = "none";

            let nutritionPer100 = getNutritionPer100(food);

            selectedFoodName = russianQuery;
            selectedNutritionPer100 = nutritionPer100;

            document.getElementById("selected-product-name").textContent = russianQuery;
            document.getElementById("food-weight-input").value = 100;

            updatePreview();
            showStep("weight");
        })
        .catch(function (error) {
            document.getElementById("search-status").style.display = "none";
            showError("Ошибка загрузки данных: " + error.message);
            showStep("search");
        });
}


let weightInput = document.getElementById("food-weight-input");

weightInput.addEventListener("input", function () {
    updatePreview();
});

function updatePreview() {
    let grams = Number(document.getElementById("food-weight-input").value);

    if (grams <= 0 || selectedNutritionPer100 === null) {
        return;
    }

    let nutrition = calcNutrition(selectedNutritionPer100, grams);

    document.getElementById("preview-calories").textContent = nutrition.calories;
    document.getElementById("preview-protein").textContent = nutrition.protein;
    document.getElementById("preview-fat").textContent = nutrition.fat;
    document.getElementById("preview-carbs").textContent = nutrition.carbohydrates;
}


let backToSearchBtn = document.getElementById("back-to-search-btn");
let backToResultsBtn = document.getElementById("back-to-results-btn");

backToSearchBtn.addEventListener("click", function () {
    showStep("search");
});

backToResultsBtn.addEventListener("click", function () {
    showStep("results");
});


let addFoodBtn = document.getElementById("add-food-btn");

addFoodBtn.addEventListener("click", function () {
    let grams = Number(document.getElementById("food-weight-input").value);
    let meal = document.getElementById("meal-select").value;

    if (grams <= 0) {
        alert("Введите корректное количество граммов");
        return;
    }

    if (selectedNutritionPer100 === null) {
        return;
    }

    let nutrition = calcNutrition(selectedNutritionPer100, grams);

    let entry = {
        name: selectedFoodName,
        grams: grams,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbohydrates: nutrition.carbohydrates
    };

    diary[meal].push(entry);

    renderDiary();
    updateTotals();

    saveDiary();

    modalOverlay.style.display = "none";
});


function renderDiary() {
    renderMeal("breakfast", "breakfast-list", "breakfast-kcal");
    renderMeal("lunch", "lunch-list", "lunch-kcal");
    renderMeal("dinner", "dinner-list", "dinner-kcal");
    renderMeal("snack", "snack-list", "snack-kcal");
}

function renderMeal(mealKey, listId, kcalId) {
    let list = document.getElementById(listId);
    let kcalEl = document.getElementById(kcalId);
    let entries = diary[mealKey];

    list.innerHTML = "";

    let mealTotal = 0;

    for (let i = 0; i < entries.length; i++) {
        let entry = entries[i];
        mealTotal = mealTotal + entry.calories;

        let row = document.createElement("div");
        row.className = "food-row";
        row.innerHTML =
            "<span class='food-emoji'>🍽</span>" +
            "<div class='food-info'>" +
                "<div class='food-name'>" + entry.name + " (" + entry.grams + " г)</div>" +
                "<div class='food-kcal-small'>" + entry.calories + " ккал · Б: " + entry.protein + "г · Ж: " + entry.fat + "г · У: " + entry.carbohydrates + "г</div>" +
            "</div>" +
            "<button class='food-delete' data-meal='" + mealKey + "' data-index='" + i + "'>✕</button>";

        list.appendChild(row);
    }

    kcalEl.textContent = mealTotal + " ккал";

    let deleteButtons = list.querySelectorAll(".food-delete");

    for (let j = 0; j < deleteButtons.length; j++) {
        deleteButtons[j].addEventListener("click", function () {
            let mealName = this.dataset.meal;
            let index = Number(this.dataset.index);
            diary[mealName].splice(index, 1);
            renderDiary();
            updateTotals();

            saveDiary();
        });
    }
}


function updateTotals() {
    let totalCalories = 0;
    let totalProtein = 0;
    let totalFat = 0;
    let totalCarbs = 0;

    let meals = ["breakfast", "lunch", "dinner", "snack"];

    for (let i = 0; i < meals.length; i++) {
        let entries = diary[meals[i]];
        for (let j = 0; j < entries.length; j++) {
            totalCalories = totalCalories + entries[j].calories;
            totalProtein = totalProtein + entries[j].protein;
            totalFat = totalFat + entries[j].fat;
            totalCarbs = totalCarbs + entries[j].carbohydrates;
        }
    }

    let freshNorm = localStorage.getItem("dailyNorm");
    if (freshNorm !== null) {
        dailyNorm = Number(freshNorm);
    }

    let remaining = dailyNorm - totalCalories;
    let percent = Math.round((totalCalories / dailyNorm) * 100);

    if (percent > 100) {
        percent = 100;
    }

    document.getElementById("total-calories").textContent = totalCalories;
    document.getElementById("calories-progress").style.width = percent + "%";
    document.getElementById("progress-label").textContent = percent + "% от нормы";
    document.getElementById("total-protein").textContent = Math.round(totalProtein * 10) / 10 + " г";
    document.getElementById("total-fat").textContent = Math.round(totalFat * 10) / 10 + " г";
    document.getElementById("total-carbs").textContent = Math.round(totalCarbs * 10) / 10 + " г";

    let remainingEl = document.getElementById("cal-remaining-block");

    if (totalCalories === 0) {
        remainingEl.style.color = "#888";
        remainingEl.textContent = "Осталось: " + dailyNorm + " ккал";
    } else if (remaining > 0) {
        remainingEl.style.color = "#2E7D52";
        remainingEl.textContent = "Осталось: " + remaining + " ккал";
    } else if (remaining === 0) {
        remainingEl.style.color = "#2E7D52";
        remainingEl.textContent = "✓ Норма выполнена!";
    } else {
        remainingEl.style.color = "#E53935";
        remainingEl.textContent = "Превышение: +" + Math.abs(remaining) + " ккал";
    }
}

loadDiary();
