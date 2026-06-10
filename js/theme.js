(function () {
    function applyTheme(dark) {
        if (dark) {
            document.documentElement.classList.add("dark");
        } else {
            document.documentElement.classList.remove("dark");
        }
        let btn = document.getElementById("theme-toggle-btn");
        if (btn) btn.textContent = dark ? "☀️" : "🌙";
        let toggle = document.getElementById("s-dark-mode");
        if (toggle) toggle.checked = dark;
    }

    function setTheme(dark) {
        localStorage.setItem("darkTheme", dark ? "1" : "0");
        applyTheme(dark);
    }

    applyTheme(localStorage.getItem("darkTheme") === "1");

    document.addEventListener("DOMContentLoaded", function () {
        applyTheme(localStorage.getItem("darkTheme") === "1");

        let btn = document.getElementById("theme-toggle-btn");
        if (btn) {
            btn.addEventListener("click", function () {
                setTheme(!document.documentElement.classList.contains("dark"));
            });
        }

        let toggle = document.getElementById("s-dark-mode");
        if (toggle) {
            toggle.addEventListener("change", function () {
                setTheme(this.checked);
            });
        }
    });
})();
