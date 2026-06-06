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
    } else if (activity === "veryhigh") {
        factor = 1.9;
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

function calcDailyNorm(weight, height, age, gender, activity, goal) {
    let bmr = calcBMR(weight, height, age, gender);

    let factor = getActivityFactor(activity);
    let total = bmr * factor;

    let result = applyGoal(total, goal);

    return Math.round(result);
}


let norm1 = calcDailyNorm(72, 175, 22, "male", "moderate", "keep");
console.log("Мужчина 72 кг, 175 см, 22 года, умеренная активность, удержать вес:");
console.log("Норма: " + norm1 + " ккал/день");
console.log("");


let norm2 = calcDailyNorm(60, 165, 25, "female", "light", "lose");
console.log("Женщина 60 кг, 165 см, 25 лет, лёгкая активность, похудеть:");
console.log("Норма: " + norm2 + " ккал/день");
console.log("");


let norm3 = calcDailyNorm(80, 180, 30, "male", "high", "gain");
console.log("Мужчина 80 кг, 180 см, 30 лет, высокая активность, набрать массу:");
console.log("Норма: " + norm3 + " ккал/день");
console.log("");

console.log("=== Проверка БОВ ===");

let bmrMale = calcBMR(72, 175, 22, "male");
console.log("БОВ мужчины (72/175/22): " + bmrMale + " ккал");

let bmrFemale = calcBMR(60, 165, 25, "female");
console.log("БОВ женщины (60/165/25): " + bmrFemale + " ккал");
