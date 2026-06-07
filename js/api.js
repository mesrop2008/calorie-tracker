let consumerKey = "fb3a0ed0efec42e9a07c06bb74f1a103";
let consumerSecret = "b271cc03ec6f45cc81c702697a8b567f";

let fatSecretUrl = "https://platform.fatsecret.com/rest/server.api";
let proxyUrl = "https://corsproxy.io/?url=";


function generateNonce() {
    let result = "";
    let chars = "abcdefghijklmnopqrstuvwxyz0123456789";

    for (let i = 0; i < 32; i++) {
        let randomIndex = Math.floor(Math.random() * chars.length);
        result = result + chars[randomIndex];
    }

    return result;
}


function getTimestamp() {
    return Math.floor(Date.now() / 1000).toString();
}


function encodeRFC3986(str) {
    return encodeURIComponent(str)
        .replace(/!/g, "%21")
        .replace(/\*/g, "%2A")
        .replace(/'/g, "%27")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29");
}


function signRequest(params, secret) {
    let sortedKeys = Object.keys(params).sort();
    let paramString = "";

    for (let i = 0; i < sortedKeys.length; i++) {
        if (i > 0) {
            paramString = paramString + "&";
        }
        paramString = paramString + encodeRFC3986(sortedKeys[i]) + "=" + encodeRFC3986(params[sortedKeys[i]]);
    }

    let signatureBase = "GET" + "&" + encodeRFC3986(fatSecretUrl) + "&" + encodeRFC3986(paramString);
    let signingKey = encodeRFC3986(secret) + "&";

    let encoder = new TextEncoder();
    let keyBytes = encoder.encode(signingKey);
    let dataBytes = encoder.encode(signatureBase);

    return crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"]
    ).then(function (key) {
        return crypto.subtle.sign("HMAC", key, dataBytes);
    }).then(function (signature) {
        let bytes = new Uint8Array(signature);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
            binary = binary + String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    });
}


function buildUrl(params) {
    let queryString = "";
    let keys = Object.keys(params);

    for (let i = 0; i < keys.length; i++) {
        if (i > 0) {
            queryString = queryString + "&";
        }
        queryString = queryString + encodeURIComponent(keys[i]) + "=" + encodeURIComponent(params[keys[i]]);
    }

    let originalUrl = fatSecretUrl + "?" + queryString;
    return proxyUrl + encodeURIComponent(originalUrl);
}


function translateToEnglish(text) {
    let googleUrl = "https://translate.googleapis.com/translate_a/single?client=gtx&sl=ru&tl=en&dt=t&q=" + encodeURIComponent(text);

    return fetch(googleUrl)
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Ошибка перевода");
            }
            return response.json();
        })
        .then(function (data) {
            let translatedText = data[0][0][0];
            return translatedText;
        });
}


function searchFood(russianQuery) {
    return translateToEnglish(russianQuery)
        .then(function (englishQuery) {
            let timestamp = getTimestamp();
            let nonce = generateNonce();

            let params = {
                method: "foods.search",
                search_expression: englishQuery,
                format: "json",
                max_results: "5",
                oauth_consumer_key: consumerKey,
                oauth_nonce: nonce,
                oauth_signature_method: "HMAC-SHA1",
                oauth_timestamp: timestamp,
                oauth_version: "1.0"
            };

            return signRequest(params, consumerSecret)
                .then(function (signature) {
                    params.oauth_signature = signature;
                    let fullUrl = buildUrl(params);
                    return fetch(fullUrl);
                });
        })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Ошибка сети при поиске продукта");
            }
            return response.json();
        })
        .then(function (data) {
            if (!data.foods || !data.foods.food) {
                throw new Error("Продукт не найден. Попробуйте другое название.");
            }

            let foods = data.foods.food;

            if (!Array.isArray(foods)) {
                foods = [foods];
            }

            return foods;
        });
}


function getFoodDetails(foodId) {
    let timestamp = getTimestamp();
    let nonce = generateNonce();

    let params = {
        method: "food.get.v2",
        food_id: foodId,
        format: "json",
        oauth_consumer_key: consumerKey,
        oauth_nonce: nonce,
        oauth_signature_method: "HMAC-SHA1",
        oauth_timestamp: timestamp,
        oauth_version: "1.0"
    };

    return signRequest(params, consumerSecret)
        .then(function (signature) {
            params.oauth_signature = signature;
            let fullUrl = buildUrl(params);
            return fetch(fullUrl);
        })
        .then(function (response) {
            if (!response.ok) {
                throw new Error("Ошибка при получении данных о продукте");
            }
            return response.json();
        })
        .then(function (data) {
            if (!data.food) {
                throw new Error("Данные о продукте не найдены");
            }
            return data.food;
        });
}


function calcNutrition(nutritionPer100, grams) {
    let calories = (nutritionPer100.calories / 100) * grams;
    let protein = (nutritionPer100.protein / 100) * grams;
    let fat = (nutritionPer100.fat / 100) * grams;
    let carbohydrates = (nutritionPer100.carbohydrates / 100) * grams;

    let result = {
        calories: Math.round(calories),
        protein: Math.round(protein * 10) / 10,
        fat: Math.round(fat * 10) / 10,
        carbohydrates: Math.round(carbohydrates * 10) / 10
    };

    return result;
}


function getNutritionPer100(food) {
    let servings = food.servings.serving;

    if (!Array.isArray(servings)) {
        servings = [servings];
    }

    let per100 = null;

    for (let i = 0; i < servings.length; i++) {
        let serving = servings[i];
        if (serving.metric_serving_unit === "g" && parseFloat(serving.metric_serving_amount) === 100) {
            per100 = serving;
            break;
        }
    }

    if (per100 === null) {
        let firstServing = servings[0];
        let amount = parseFloat(firstServing.metric_serving_amount) || 100;

        per100 = {
            calories: (parseFloat(firstServing.calories) / amount) * 100,
            protein: (parseFloat(firstServing.protein) / amount) * 100,
            fat: (parseFloat(firstServing.fat) / amount) * 100,
            carbohydrates: (parseFloat(firstServing.carbohydrate) / amount) * 100
        };
    } else {
        per100 = {
            calories: parseFloat(per100.calories),
            protein: parseFloat(per100.protein),
            fat: parseFloat(per100.fat),
            carbohydrates: parseFloat(per100.carbohydrate)
        };
    }

    return per100;
}
