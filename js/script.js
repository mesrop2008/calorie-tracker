function calcBMR(weight, height, age, gender) {
    let bmr = 10 * weight + 6.25 * height - 5 * age;

    if (gender === "male") {
        bmr = bmr + 5;
    } else {
        bmr = bmr - 161;
    }

    return bmr;
}


function getActivityFactor(activity) {
    let factor = 1.2;

    if (activity === "sedentary") {
        factor = 1.2;
    } else if (activity === "light") {
        factor = 1.375;
    } else if (activity === "moderate") {
        factor = 1.55;
    } else if (activity === "high") {
        factor = 1.725;
    }

    return factor;
}


function applyGoal(calories, goal) {
    let result = calories;

    if (goal === "lose") {
        result = calories - 500;
    } else if (goal === "gain") {
        result = calories + 500;
    } else {
        result = calories;
    }

    return result;
}


let selectedGender = "male";
let selectedGoal = "keep";


let genderGroup = document.getElementById("gender-group");
let genderButtons = genderGroup.querySelectorAll(".toggle-btn");

genderButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        genderButtons.forEach(function (b) {
            b.classList.remove("active");
        });
        btn.classList.add("active");
        selectedGender = btn.dataset.gender;
    });
});


let goalGroup = document.getElementById("goal-group");
let goalButtons = goalGroup.querySelectorAll(".goal-btn");

goalButtons.forEach(function (btn) {
    btn.addEventListener("click", function () {
        goalButtons.forEach(function (b) {
            b.classList.remove("active");
        });
        btn.classList.add("active");
        selectedGoal = btn.dataset.goal;
    });
});


function readForm() {
    let weight = Number(document.getElementById("weight").value);
    let height = Number(document.getElementById("height").value);
    let age = Number(document.getElementById("age").value);
    let activity = document.getElementById("activity").value;

    let data = {
        weight: weight,
        height: height,
        age: age,
        gender: selectedGender,
        activity: activity,
        goal: selectedGoal
    };

    return data;
}


function validate(data) {
    if (data.weight < 30 || data.weight > 300) {
        return "Введите корректный вес (30-300 кг)";
    }

    if (data.height < 100 || data.height > 250) {
        return "Введите корректный рост (100-250 см)";
    }

    if (data.age < 10 || data.age > 120) {
        return "Введите корректный возраст (10-120 лет)";
    }

    return null;
}


function goalText(goal) {
    if (goal === "lose") {
        return "снижение веса";
    } else if (goal === "gain") {
        return "набор массы";
    } else {
        return "поддержание веса";
    }
}


function showResult(data) {
    let bmr = calcBMR(data.weight, data.height, data.age, data.gender);
    let factor = getActivityFactor(data.activity);
    let total = bmr * factor;
    let norm = Math.round(applyGoal(total, data.goal));

    document.getElementById("norm-title").textContent = "Ваша норма: " + norm + " ккал/день";
    document.getElementById("norm-sub").textContent = "Цель: " + goalText(data.goal) + " · Коэфф. активности: " + factor;

    document.getElementById("snap-calories").textContent = "1 450";
    document.getElementById("snap-calories-sub").textContent = "из " + norm + " ккал";
}


let calcButton = document.getElementById("calc-btn");

calcButton.addEventListener("click", function () {
    let data = readForm();
    let error = validate(data);

    if (error !== null) {
        alert(error);
        return;
    }

    showResult(data);
});
