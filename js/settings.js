let db = new Dexie("CalorieTrackerDB");
db.version(1).stores({ diary: "date" });
db.version(2).stores({ diary: "date", settings: "key" });

let ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725 };
let ACTIVITY_LABELS = { sedentary: "сидячий", light: "лёгкая", moderate: "умеренная", high: "высокая" };
let GOAL_DELTA = { lose: -500, keep: 0, gain: 500 };
let GOAL_LABELS = { lose: "снижение веса", keep: "поддержание веса", gain: "набор массы" };

let selectedGender = "male";
let selectedGoal = "keep";

let FIELD_RULES = {
    "s-weight": { min: 30, max: 300, label: "Вес от 30 до 300 кг" },
    "s-height": { min: 100, max: 250, label: "Рост от 100 до 250 см" },
    "s-age": { min: 10, max: 120, label: "Возраст от 10 до 120 лет" }
};

function setText(id, text) {
    let el = document.getElementById(id);
    if (el) el.textContent = text;
}

function showToast(msg) {
    let t = document.getElementById("save-toast");
    t.textContent = "✓ " + (msg || "Сохранено");
    t.classList.add("show");
    setTimeout(function () { t.classList.remove("show"); }, 2000);
}

function setFieldError(id, message) {
    let input = document.getElementById(id);
    let errorEl = document.getElementById(id + "-error");
    if (!input) return;
    if (message) {
        input.classList.add("invalid");
        if (errorEl) { errorEl.textContent = message; errorEl.style.display = "block"; }
    } else {
        input.classList.remove("invalid");
        if (errorEl) { errorEl.style.display = "none"; }
    }
}

function validateField(id) {
    let input = document.getElementById(id);
    let rule = FIELD_RULES[id];
    let raw = input.value.trim();

    if (!raw) {
        setFieldError(id, "Обязательное поле");
        return false;
    }

    let val = Number(raw);
    if (isNaN(val) || val < rule.min || val > rule.max) {
        setFieldError(id, rule.label);
        return false;
    }

    setFieldError(id, null);
    return true;
}

function validateAll() {
    let ok = true;
    Object.keys(FIELD_RULES).forEach(function (id) {
        if (!validateField(id)) ok = false;
    });
    return ok;
}

Object.keys(FIELD_RULES).forEach(function (id) {
    let input = document.getElementById(id);
    if (!input) return;
    input.addEventListener("input", function () { validateField(id); recalcGoals(); });
    input.addEventListener("blur", function () { validateField(id); });
});

function calcBMR(w, h, a, g) {
    return 10 * w + 6.25 * h - 5 * a + (g === "male" ? 5 : -161);
}

function calcMacros(norm) {
    return {
        protein: Math.round((norm * 0.30) / 4),
        fat: Math.round((norm * 0.30) / 9),
        carbs: Math.round((norm * 0.40) / 4)
    };
}

function recalcGoals() {
    let w = Number(document.getElementById("s-weight").value);
    let h = Number(document.getElementById("s-height").value);
    let a = Number(document.getElementById("s-age").value);
    let act = document.getElementById("s-activity").value;

    if (!w || !h || !a) {
        setText("s-norm-display", "—");
        setText("s-factor-display", "—");
        setText("s-bmr-display", "—");
        return;
    }

    let bmr = Math.round(calcBMR(w, h, a, selectedGender));
    let factor = ACTIVITY_FACTORS[act];
    let norm = Math.round(bmr * factor + GOAL_DELTA[selectedGoal]);

    setText("s-norm-display", norm + " ккал/день");
    setText("s-factor-display", factor + " (" + ACTIVITY_LABELS[act] + ")");
    setText("s-bmr-display", bmr + " ккал");
}

function loadSettingsIntoForm(data) {
    if (!data) return;

    if (data.weight) document.getElementById("s-weight").value = data.weight;
    if (data.height) document.getElementById("s-height").value = data.height;
    if (data.age) document.getElementById("s-age").value = data.age;
    if (data.activity) document.getElementById("s-activity").value = data.activity;

    if (data.gender) {
        selectedGender = data.gender;
        document.querySelectorAll("#s-gender-group .toggle-btn").forEach(function (b) {
            b.classList.toggle("active", b.dataset.gender === data.gender);
        });
    }

    if (data.goal) {
        selectedGoal = data.goal;
        document.querySelectorAll("#s-goal-group .goal-btn").forEach(function (b) {
            b.classList.toggle("active", b.dataset.goal === data.goal);
        });
    }

    recalcGoals();
}

db.settings.get("userParams").then(function (data) {
    if (data) loadSettingsIntoForm(data);
});

db.diary.count().then(function (n) {
    setText("s-db-days", n + " дн.");
});

document.querySelectorAll("#s-gender-group .toggle-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        document.querySelectorAll("#s-gender-group .toggle-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        selectedGender = btn.dataset.gender;
        recalcGoals();
    });
});

document.querySelectorAll("#s-goal-group .goal-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        document.querySelectorAll("#s-goal-group .goal-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        selectedGoal = btn.dataset.goal;
        recalcGoals();
    });
});

document.getElementById("s-activity").addEventListener("change", recalcGoals);

function saveAll() {
    if (!validateAll()) return;

    let w = Number(document.getElementById("s-weight").value);
    let h = Number(document.getElementById("s-height").value);
    let a = Number(document.getElementById("s-age").value);
    let act = document.getElementById("s-activity").value;

    let bmr = Math.round(calcBMR(w, h, a, selectedGender));
    let factor = ACTIVITY_FACTORS[act];
    let norm = Math.round(bmr * factor + GOAL_DELTA[selectedGoal]);
    let macros = calcMacros(norm);

    let userParams = {
        key: "userParams",
        weight: w,
        height: h,
        age: a,
        gender: selectedGender,
        activity: act,
        goal: selectedGoal
    };

    let normData = {
        key: "norm",
        norm: norm,
        protein: macros.protein,
        fat: macros.fat,
        carbs: macros.carbs,
        goalLabel: GOAL_LABELS[selectedGoal],
        factor: factor
    };

    Promise.all([
        db.settings.put(userParams),
        db.settings.put(normData)
    ]).then(function () {
        localStorage.setItem("dailyNorm", norm);
        showToast("Сохранено");
        recalcGoals();
    });
}

document.getElementById("save-params-btn").addEventListener("click", saveAll);
document.getElementById("save-goals-btn").addEventListener("click", saveAll);

document.getElementById("clear-history-btn").addEventListener("click", function () {
    document.getElementById("confirm-dialog").style.display = "flex";
});

document.getElementById("confirm-cancel").addEventListener("click", function () {
    document.getElementById("confirm-dialog").style.display = "none";
});

document.getElementById("confirm-clear").addEventListener("click", function () {
    db.diary.clear().then(function () {
        document.getElementById("confirm-dialog").style.display = "none";
        setText("s-db-days", "0 дн.");
        showToast("История очищена");
    });
});

let menuItems = document.querySelectorAll(".settings-menu-item");
menuItems.forEach(function (item) {
    item.addEventListener("click", function (e) {
        e.preventDefault();
        let sectionId = item.dataset.section;

        menuItems.forEach(function (i) { i.classList.remove("active"); });
        item.classList.add("active");

        document.querySelectorAll(".settings-section").forEach(function (s) {
            s.classList.remove("visible");
        });
        document.getElementById(sectionId).classList.add("visible");
    });
});
