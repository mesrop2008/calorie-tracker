let db = new Dexie("CalorieTrackerDB");
        db.version(1).stores({ diary: "date" });
        db.version(2).stores({ diary: "date", settings: "key" });

        let MONTHS_RU = ["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"];
        let MONTHS_SHORT = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];
        let WEEKDAYS_SHORT = ["Вс","Пн","Вт","Ср","Чт","Пт","Сб"];

        function todayStr() {
            let d = new Date();
            return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
        }

        function addDays(dateStr, n) {
            let parts = dateStr.split("-");
            let d = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
            d.setDate(d.getDate() + n);
            return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
        }

        function formatLabel(dateStr) {
            let parts = dateStr.split("-");
            let d = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));
            return WEEKDAYS_SHORT[d.getDay()] + ", " + d.getDate() + " " + MONTHS_RU[d.getMonth()] + " " + d.getFullYear();
        }

        function formatShort(dateStr) {
            let parts = dateStr.split("-");
            return Number(parts[2]) + " " + MONTHS_SHORT[Number(parts[1])-1];
        }

        function setDates(from, to) {
            document.getElementById("date-from").value = from;
            document.getElementById("date-to").value   = to;
        }

        function applyPeriod(days) {
            let to   = todayStr();
            let from = addDays(to, -days + 1);
            setDates(from, to);
            loadAndRender(from, to);
        }

        function loadAndRender(from, to) {
            db.diary.where("date").between(from, to, true, true).toArray()
                .then(function(records) {
                    records.sort(function(a, b) { return b.date.localeCompare(a.date); });
                    renderHistory(records, from, to);
                })
                .catch(function() { renderEmpty(); });
        }

        function renderEmpty() {
            document.getElementById("history-list").innerHTML =
                "<div style='padding:48px 20px; text-align:center; color:#888; font-size:14px;'>За этот период записей нет.<br>Начните вести дневник — данные появятся здесь.</div>";
            document.getElementById("summary-section").style.display = "none";
        }

        function renderHistory(records, from, to) {
            let list = document.getElementById("history-list");

            if (records.length === 0) { renderEmpty(); return; }

            document.getElementById("history-range").textContent = formatShort(from) + " — " + formatShort(to);

            let totalCal = 0, normDays = 0;
            records.forEach(function(r) {
                totalCal += r.totalCalories || 0;
                if (r.normReached) normDays++;
            });
            let avgCal = Math.round(totalCal / records.length);

            document.getElementById("sum-avg-cal").innerHTML = avgCal + " <span class='summary-small'>ккал/день</span>";
            document.getElementById("sum-norm-days").textContent = normDays + " из " + records.length;
            document.getElementById("sum-total-days").textContent = records.length + " дн.";
            document.getElementById("summary-section").style.display = "block";

            list.innerHTML = "";

            records.forEach(function(r) {
                let cal      = r.totalCalories || 0;
                let norm     = r.normCalories  || 0;
                let prot     = r.totalProtein  || 0;
                let fat      = r.totalFat      || 0;
                let carbs    = r.totalCarbs    || 0;
                let percent  = norm > 0 ? Math.min(100, Math.round(cal / norm * 100)) : 0;
                let diff     = cal - norm;
                let isToday  = r.date === todayStr();

                let tagHtml;
                if (isToday) {
                    tagHtml = "<span class='day-tag tag-yellow'>Сегодня</span>";
                } else if (norm === 0 || cal === 0) {
                    tagHtml = "<span class='day-tag tag-yellow'>Нет данных</span>";
                } else if (r.normReached && diff <= 0) {
                    tagHtml = "<span class='day-tag tag-green'>В норме ✓</span>";
                } else if (diff > 0) {
                    tagHtml = "<span class='day-tag tag-red'>+" + diff + " ккал</span>";
                } else {
                    tagHtml = "<span class='day-tag tag-yellow'>" + diff + " ккал</span>";
                }

                let parts = r.date.split("-");
                let d = new Date(Number(parts[0]), Number(parts[1])-1, Number(parts[2]));

                let barColor = diff > 0 ? "background:#E53935" : (r.normReached ? "background:#2E7D52" : "");

                let row = document.createElement("div");
                row.className = "day-row";
                row.style.cursor = "default";
                row.innerHTML =
                    "<div class='day-row-date'>"
                        + "<div class='day-row-weekday'>" + WEEKDAYS_SHORT[d.getDay()] + "</div>"
                        + "<div class='day-row-num'>" + d.getDate() + "</div>"
                        + "<div class='day-row-month'>" + MONTHS_SHORT[d.getMonth()] + "</div>"
                    + "</div>"
                    + "<div class='vdivider'></div>"
                    + "<div class='day-row-main'>"
                        + "<div class='day-row-kcal'>"
                            + "<span class='day-row-eaten'>" + cal + "</span>"
                            + "<span class='day-row-norm'>из " + (norm || "—") + " ккал</span>"
                        + "</div>"
                        + "<div class='progress-wrap'><div class='progress-bar' style='width:" + percent + "%;" + barColor + "'></div></div>"
                        + "<div class='day-row-macros'>"
                            + "<span class='day-row-macro'>Б: <span>" + prot + " г</span></span>"
                            + "<span class='day-row-macro'>Ж: <span>" + fat  + " г</span></span>"
                            + "<span class='day-row-macro'>У: <span>" + carbs + " г</span></span>"
                        + "</div>"
                    + "</div>"
                    + tagHtml;

                list.appendChild(row);
            });
        }

        let periodTabs = document.querySelectorAll(".period-tab");
        periodTabs.forEach(function(tab) {
            tab.addEventListener("click", function() {
                periodTabs.forEach(function(t) { t.classList.remove("active"); });
                tab.classList.add("active");
                applyPeriod(Number(tab.dataset.period));
            });
        });

        document.getElementById("apply-filter-btn").addEventListener("click", function() {
            let from = document.getElementById("date-from").value;
            let to   = document.getElementById("date-to").value;
            if (!from || !to) return;
            periodTabs.forEach(function(t) { t.classList.remove("active"); });
            loadAndRender(from, to);
        });

        applyPeriod(30);