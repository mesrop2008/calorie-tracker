let normDb = new Dexie("CalorieTrackerDB");
normDb.version(1).stores({ diary: "date" });
normDb.version(2).stores({ diary: "date", settings: "key" });


let ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
let GOAL_DELTA = { lose: -500, keep: 0, gain: +500 };
let GOAL_LABELS = { lose: "снижение веса", keep: "поддержание веса", gain: "набор массы" };

function calcNorm(weight, height, age, gender, activity, goal) {
    let bmr = 10 * weight + 6.25 * height - 5 * age + (gender === "male" ? 5 : -161);
    return Math.round(bmr * ACTIVITY_FACTORS[activity] + GOAL_DELTA[goal]);
}

function calcMacros(norm) {
    return {
        protein: Math.round((norm * 0.30) / 4),
        fat:     Math.round((norm * 0.30) / 9),
        carbs:   Math.round((norm * 0.40) / 4)
    };
}

let selectedGender = "male";
let selectedGoal   = "keep";

function setupToggleGroup(groupId, dataAttr, onChange) {
    let group = document.getElementById(groupId);
    let buttons = group.querySelectorAll("[" + dataAttr + "]");
    buttons.forEach(function(btn) {
        btn.addEventListener("click", function() {
            buttons.forEach(function(b) { b.classList.remove("active"); });
            btn.classList.add("active");
            onChange(btn.dataset[dataAttr.replace("data-", "")]);
        });
    });
}

setupToggleGroup("gender-group", "data-gender", function(val) { selectedGender = val; });
setupToggleGroup("goal-group",   "data-goal",   function(val) { selectedGoal   = val; });

function validate(weight, height, age) {
    if (weight < 30  || weight > 300) return "Введите корректный вес (30-300 кг)";
    if (height < 100 || height > 250) return "Введите корректный рост (100-250 см)";
    if (age  < 10   || age  > 120)   return "Введите корректный возраст (10-120 лет)";
    return null;
}

function applyNormToUI(n) {
    let set = function(id, text) { let el = document.getElementById(id); if (el) el.textContent = text; };
    set("norm-title",        "Ваша норма: " + n.norm + " ккал/день");
    set("norm-sub",          "Цель: " + n.goalLabel + " · Коэфф. активности: " + n.factor);
    set("norm-title-bar",    n.norm);
    set("snap-calories-sub", "из " + n.norm    + " ккал");
    set("snap-protein-sub",  "из " + n.protein + " г");
    set("snap-fat-sub",      "из " + n.fat     + " г");
    set("snap-carbs-sub",    "из " + n.carbs   + " г");
}

function getTodayKey() {
    let d = new Date();
    return d.getFullYear() + "-"
        + String(d.getMonth() + 1).padStart(2, "0") + "-"
        + String(d.getDate()).padStart(2, "0");
}

function calcDiaryTotals(record) {
    let t = { calories: 0, protein: 0, fat: 0, carbs: 0 };
    if (!record) return t;
    ["breakfast", "lunch", "dinner", "snack"].forEach(function(meal) {
        (record[meal] || []).forEach(function(e) {
            t.calories += e.calories       || 0;
            t.protein  += e.protein        || 0;
            t.fat      += e.fat            || 0;
            t.carbs    += e.carbohydrates  || 0;
        });
    });
    t.protein = Math.round(t.protein * 10) / 10;
    t.fat     = Math.round(t.fat     * 10) / 10;
    t.carbs   = Math.round(t.carbs   * 10) / 10;
    return t;
}

function setBar(id, percent) {
    let el = document.getElementById(id);
    if (el) el.style.width = percent + "%";
}

function applyDiaryToSnap(t, n) {
    let set = function(id, text) { let el = document.getElementById(id); if (el) el.textContent = text; };
    set("snap-calories", t.calories > 0 ? t.calories        : "-");
    set("snap-protein",  t.protein  > 0 ? t.protein  + " г" : "-");
    set("snap-fat",      t.fat      > 0 ? t.fat      + " г" : "-");
    set("snap-carbs",    t.carbs    > 0 ? t.carbs    + " г" : "-");

    if (!n) return;
    let pct = function(val, norm) { return norm > 0 ? Math.min(100, Math.round(val / norm * 100)) : 0; };
    setBar("snap-bar-calories", pct(t.calories, n.norm));
    setBar("snap-bar-protein",  pct(t.protein,  n.protein));
    setBar("snap-bar-fat",      pct(t.fat,       n.fat));
    setBar("snap-bar-carbs",    pct(t.carbs,     n.carbs));
}

let cachedNorm = null;
normDb.settings.get("norm").then(function(n) {
    cachedNorm = n || null;
    if (n) applyNormToUI(n);
    return normDb.diary.get(getTodayKey());
}).then(function(record) {
    applyDiaryToSnap(calcDiaryTotals(record), cachedNorm);
}).catch(function() {});

document.getElementById("calc-btn").addEventListener("click", function() {
    let weight   = Number(document.getElementById("weight").value);
    let height   = Number(document.getElementById("height").value);
    let age      = Number(document.getElementById("age").value);
    let activity = document.getElementById("activity").value;

    let error = validate(weight, height, age);
    if (error) { alert(error); return; }

    let norm     = calcNorm(weight, height, age, selectedGender, activity, selectedGoal);
    let macros   = calcMacros(norm);
    let factor   = ACTIVITY_FACTORS[activity];
    let goalLabel = GOAL_LABELS[selectedGoal];

    let normData = { key: "norm", norm: norm, protein: macros.protein, fat: macros.fat, carbs: macros.carbs, goalLabel: goalLabel, factor: factor };

    normDb.settings.put(normData).catch(function(e) { console.log("Ошибка сохранения:", e); });
    localStorage.setItem("dailyNorm", norm);
    applyNormToUI(normData);
});
